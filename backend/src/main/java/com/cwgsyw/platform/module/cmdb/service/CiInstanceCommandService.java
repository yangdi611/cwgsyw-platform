package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.instance.*;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiChangeRecord;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiInstanceRel;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Write side of the former {@code CiInstanceService} (Issue #64 AC9): create,
 * update, and delete with dual-write to {@code audit_log} and the canonical
 * {@code ci_change_record} (Issue #64 AC6). Read paths live in
 * {@link CiInstanceQueryService}. Behaviour is unchanged.
 */
@Service
@RequiredArgsConstructor
public class CiInstanceCommandService {

    private final CiInstanceMapper ciInstanceMapper;
    private final CiModelMapper ciModelMapper;
    private final CiAttributeMapper ciAttributeMapper;
    private final CiInstanceRelMapper ciInstanceRelMapper;
    private final AuditLogMapper auditLogMapper;
    private final CiChangeRecordMapper ciChangeRecordMapper;
    private final ObjectMapper objectMapper;

    // @Lazy no longer needed: CiChangeService now reads ci_change_record directly
    // (Issue #64 AC6) and no longer participates in any injection cycle with this service.
    private final CiChangeService ciChangeService;

    private final CiFieldSchemaValidator schemaValidator;
    private final CiInstanceUniquenessValidator uniquenessValidator;
    // Read-only detail projection reused by create/update return values.
    private final CiInstanceQueryService ciInstanceQueryService;

    @Transactional
    public CiInstanceDetailVO create(CreateInstanceRequest req, String tenantId, Long operatorId) {
        CiModel model = loadModel(req.getModelId(), tenantId);

        LambdaQueryWrapper<CiInstance> nameCheck = new LambdaQueryWrapper<CiInstance>()
                .eq(CiInstance::getTenantId, tenantId)
                .eq(CiInstance::getModelId, model.getModelId())
                .eq(CiInstance::getName, req.getName())
                .eq(CiInstance::getIsDeleted, false);
        if (ciInstanceMapper.selectCount(nameCheck) > 0) {
            throw new IllegalArgumentException("同模型下实例名称已存在: " + req.getName());
        }

        List<CiAttribute> attrs = ciAttributeMapper.listByModel(model.getModelId(), tenantId);
        ensureTableRowIds(req.getFieldsData(), attrs);
        schemaValidator.validate(req.getFieldsData(), attrs);
        uniquenessValidator.validate(req.getFieldsData(), attrs, tenantId, model.getModelId(), null);

        CiInstance inst = new CiInstance();
        inst.setTenantId(tenantId); inst.setModelId(model.getModelId());
        inst.setName(req.getName());
        inst.setStatus(req.getStatus() != null ? req.getStatus() : "online");
        inst.setOwner(req.getOwner()); inst.setDescription(req.getDescription());
        inst.setFieldsData(stripReservedKeys(req.getFieldsData()));
        ciInstanceMapper.insert(inst);

        writeAudit(tenantId, "create_instance", inst.getId(), "ci_instance",
                operatorId, null, snapshotInstance(inst));
        writeChangeRecord(tenantId, "create", inst.getId(), inst.getModelId(), operatorId,
                diffSnapshots(Map.of(), buildChangeSnapshot(inst)));
        ciChangeService.invalidateStatsCache();
        return ciInstanceQueryService.getDetail(inst.getId(), tenantId);
    }

    /**
     * 克隆实例（spec §9.2）。复制源实例 fieldsData 并创建新实例：
     *   - name 追加「-副本」（重名则递增后缀），避免同模型名冲突；
     *   - 清空 unique 标量字段（如 asset_no/sn），避免唯一性冲突，由用户克隆后补填；
     *   - table 字段清空每行 row_id（克隆出的是新行，row_id 须重新生成以免与源行/端点链冲突）；
     *   - 剥离 `_` 前缀派生键（getDetail 注入的，不应入库）。
     * 走标准 create 流程复用全部校验与审计。
     */
    @Transactional
    public CiInstanceDetailVO clone(Long id, String tenantId, Long operatorId) {
        CiInstance src = loadInstance(id, tenantId);
        List<CiAttribute> attrs = ciAttributeMapper.listByModel(src.getModelId(), tenantId);

        Map<String, Object> fields = src.getFieldsData() == null
                ? new LinkedHashMap<>() : new LinkedHashMap<>(src.getFieldsData());
        // 去派生键
        fields.keySet().removeIf(k -> k.startsWith("_"));
        // 清 unique 标量 + 重置 table row_id
        for (CiAttribute a : attrs) {
            if (Boolean.TRUE.equals(a.getIsUnique())) {
                fields.remove(a.getFieldKey());
            } else if ("table".equals(a.getFieldType())) {
                Object v = fields.get(a.getFieldKey());
                if (v instanceof List<?> rows) {
                    String rowKey = tableRowKey(a.getOption());
                    for (Object rowObj : rows) {
                        if (rowObj instanceof Map<?, ?> row) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> r = (Map<String, Object>) row;
                            r.remove(rowKey); // ensureTableRowIds 会补新 id
                        }
                    }
                }
            }
        }

        CreateInstanceRequest req = new CreateInstanceRequest();
        req.setModelId(src.getModelId());
        req.setName(uniqueCloneName(src.getName(), src.getModelId(), tenantId));
        req.setStatus(src.getStatus());
        req.setOwner(src.getOwner());
        req.setDescription(src.getDescription());
        req.setFieldsData(fields);
        return create(req, tenantId, operatorId);
    }

    /** 生成克隆实例不重名的名称：base-副本 / base-副本2 / base-副本3 … */
    private String uniqueCloneName(String base, String modelId, String tenantId) {
        for (int i = 1; i <= 1000; i++) {
            String candidate = base + "-副本" + (i == 1 ? "" : String.valueOf(i));
            LambdaQueryWrapper<CiInstance> w = new LambdaQueryWrapper<CiInstance>()
                    .eq(CiInstance::getTenantId, tenantId)
                    .eq(CiInstance::getModelId, modelId)
                    .eq(CiInstance::getName, candidate)
                    .eq(CiInstance::getIsDeleted, false);
            if (ciInstanceMapper.selectCount(w) == 0) return candidate;
        }
        return base + "-副本-" + System.currentTimeMillis();
    }

    @Transactional
    public CiInstanceDetailVO update(Long id, UpdateInstanceRequest req, String tenantId, Long operatorId) {
        CiInstance inst = loadInstance(id, tenantId);
        String before = snapshotInstance(inst);
        Map<String, Object> beforeSnap = buildChangeSnapshot(inst);

        if (req.getName() != null) inst.setName(req.getName());
        if (req.getStatus() != null) inst.setStatus(req.getStatus());
        if (req.getOwner() != null) inst.setOwner(req.getOwner());
        if (req.getDescription() != null) inst.setDescription(req.getDescription());

        if (req.getFieldsData() != null) {
            Map<String, Object> merged = new LinkedHashMap<>();
            if (inst.getFieldsData() != null) merged.putAll(inst.getFieldsData());
            merged.putAll(req.getFieldsData());
            inst.setFieldsData(stripReservedKeys(merged));

            List<CiAttribute> attrs = ciAttributeMapper.listByModel(inst.getModelId(), tenantId);
            ensureTableRowIds(inst.getFieldsData(), attrs);
            schemaValidator.validate(inst.getFieldsData(), attrs);
            uniquenessValidator.validate(inst.getFieldsData(), attrs, tenantId, inst.getModelId(), id);
        }

        ciInstanceMapper.updateById(inst);
        writeAudit(tenantId, "update_instance", id, "ci_instance", operatorId, before, snapshotInstance(inst));
        writeChangeRecord(tenantId, "update", id, inst.getModelId(), operatorId,
                diffSnapshots(beforeSnap, buildChangeSnapshot(inst)));
        ciChangeService.invalidateStatsCache();
        return ciInstanceQueryService.getDetail(id, tenantId);
    }

    /**
     * 批量编辑（spec §9.1）。对每个 id 构造单条 {@link UpdateInstanceRequest} 并复用 {@link #update}，
     * 每条独立审计/变更记录。fields 中的 name/status/owner/description 提升为顶层列，其余键并入 fieldsData。
     * 逐条 try-catch：单条失败（如唯一冲突/校验失败）记入 failures，不阻断其余。
     */
    public BatchUpdateResultVO batchUpdate(BatchUpdateInstanceRequest req, String tenantId, Long operatorId) {
        BatchUpdateResultVO result = new BatchUpdateResultVO();
        List<Long> ids = req.getIds();
        Map<String, Object> fields = req.getFields();
        result.setTotal(ids.size());

        for (Long id : ids) {
            try {
                UpdateInstanceRequest single = new UpdateInstanceRequest();
                Map<String, Object> attrFields = new LinkedHashMap<>();
                for (Map.Entry<String, Object> e : fields.entrySet()) {
                    switch (e.getKey()) {
                        case "name" -> single.setName(asString(e.getValue()));
                        case "status" -> single.setStatus(asString(e.getValue()));
                        case "owner" -> single.setOwner(asString(e.getValue()));
                        case "description" -> single.setDescription(asString(e.getValue()));
                        default -> attrFields.put(e.getKey(), e.getValue());
                    }
                }
                if (!attrFields.isEmpty()) single.setFieldsData(attrFields);
                update(id, single, tenantId, operatorId);
                result.setSucceeded(result.getSucceeded() + 1);
            } catch (Exception ex) {
                result.setFailed(result.getFailed() + 1);
                result.getFailures().add(new BatchUpdateResultVO.FailItem(id, ex.getMessage()));
            }
        }
        return result;
    }

    private static String asString(Object v) {
        return v == null ? null : v.toString();
    }

    /**
     * 给 table 字段的每行补稳定 row_id（§4.2a"补生成更友好"）。在 schema 校验前调用。
     * row_key 取自子列 schema（默认 "row_id"）。已有非空 row_id 的行保持不变（稳定性，
     * P3 的 ci_endpoint_link 以 row_id 作端点外键）。非 table 字段跳过。
     */
    @SuppressWarnings("unchecked")
    private void ensureTableRowIds(Map<String, Object> fieldsData, List<CiAttribute> attrs) {
        if (fieldsData == null || fieldsData.isEmpty()) return;
        for (CiAttribute attr : attrs) {
            if (!"table".equals(attr.getFieldType())) continue;
            Object val = fieldsData.get(attr.getFieldKey());
            if (!(val instanceof List<?> rows)) continue;
            String rowKey = tableRowKey(attr.getOption());
            for (Object rowObj : rows) {
                if (rowObj instanceof Map<?, ?> row) {
                    Map<String, Object> r = (Map<String, Object>) row;
                    Object cur = r.get(rowKey);
                    if (cur == null || (cur instanceof String s && s.isBlank())) {
                        r.put(rowKey, java.util.UUID.randomUUID().toString());
                    }
                }
            }
        }
    }

    /** 从 table schema 读 row_key，默认 "row_id"。 */
    @SuppressWarnings("unchecked")
    private String tableRowKey(Object schema) {
        if (schema instanceof Map<?, ?> m) {
            Object rk = ((Map<String, Object>) m).get("row_key");
            if (rk instanceof String s && !s.isBlank()) return s;
        }
        return "row_id";
    }

    @Transactional
    public void delete(Long id, String tenantId, Long operatorId) {
        CiInstance inst = loadInstance(id, tenantId);
        String before = snapshotInstance(inst);
        Map<String, Object> beforeSnap = buildChangeSnapshot(inst);

        inst.setDeletedAt(LocalDateTime.now()); inst.setDeletedBy(operatorId);
        ciInstanceMapper.updateById(inst);
        ciInstanceMapper.deleteById(id);

        LambdaQueryWrapper<CiInstanceRel> relQuery = new LambdaQueryWrapper<CiInstanceRel>()
                .eq(CiInstanceRel::getTenantId, tenantId).eq(CiInstanceRel::getIsDeleted, false)
                .and(w -> w.eq(CiInstanceRel::getSrcInstanceId, id).or().eq(CiInstanceRel::getDstInstanceId, id));
        List<CiInstanceRel> rels = ciInstanceRelMapper.selectList(relQuery);
        for (CiInstanceRel rel : rels) {
            rel.setDeletedAt(LocalDateTime.now()); rel.setDeletedBy(operatorId);
            ciInstanceRelMapper.updateById(rel);
            ciInstanceRelMapper.deleteById(rel.getId());
        }

        writeAudit(tenantId, "delete_instance", id, "ci_instance", operatorId, before, null);
        writeChangeRecord(tenantId, "delete", id, inst.getModelId(), operatorId,
                diffSnapshots(beforeSnap, Map.of()));
        ciChangeService.invalidateStatsCache();
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Strip reserved keys (prefix '_') from a fieldsData map before persisting.
     * These keys are reserved for server-computed derived fields injected by
     * read-side aggregation (see CiInstanceQueryService); clients must not
     * round-trip them on save. User-defined attribute keys cannot start with
     * '_' (regex {@code ^[a-z][a-z0-9_]*$}), so this filter is safe.
     */
    private Map<String, Object> stripReservedKeys(Map<String, Object> data) {
        if (data == null) return null;
        Map<String, Object> out = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : data.entrySet()) {
            if (e.getKey() != null && !e.getKey().startsWith("_")) {
                out.put(e.getKey(), e.getValue());
            }
        }
        return out;
    }

    private CiModel loadModel(String modelCode, String tenantId) {
        return ciModelMapper.findByName(modelCode, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("模型不存在: " + modelCode));
    }

    private CiInstance loadInstance(Long id, String tenantId) {
        CiInstance inst = ciInstanceMapper.selectById(id);
        if (inst == null || inst.getIsDeleted() || !inst.getTenantId().equals(tenantId))
            throw new IllegalArgumentException("实例不存在");
        return inst;
    }

    private String snapshotInstance(CiInstance inst) {
        try {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", inst.getId()); map.put("modelId", inst.getModelId());
            map.put("name", inst.getName()); map.put("status", inst.getStatus());
            map.put("owner", inst.getOwner()); map.put("fieldsData", inst.getFieldsData());
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) { return "{}"; }
    }

    /**
     * Flat field map for the domain change record: built-in fields plus every
     * dynamic attribute from {@code fieldsData} flattened to the top level, so
     * the structured diff captures true field-level changes (Issue #64 AC6).
     */
    private Map<String, Object> buildChangeSnapshot(CiInstance inst) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("name", inst.getName());
        map.put("status", inst.getStatus());
        map.put("owner", inst.getOwner());
        if (inst.getDescription() != null) map.put("description", inst.getDescription());
        if (inst.getFieldsData() != null) map.putAll(inst.getFieldsData());
        return map;
    }

    /**
     * Compute the structured field-level diff
     * {@code [{field, before, after}]} between two snapshots. A key present on
     * only one side yields a {@code null} before/after (add / remove); a value
     * change yields both sides (modify). {@code null} maps are treated as empty.
     */
    private List<Map<String, Object>> diffSnapshots(Map<String, Object> before,
                                                    Map<String, Object> after) {
        List<Map<String, Object>> changes = new ArrayList<>();
        Set<String> allKeys = new LinkedHashSet<>();
        if (before != null) allKeys.addAll(before.keySet());
        if (after != null) allKeys.addAll(after.keySet());
        for (String key : allKeys) {
            Object b = before != null ? before.get(key) : null;
            Object a = after != null ? after.get(key) : null;
            if (Objects.equals(b, a)) continue;
            Map<String, Object> fc = new LinkedHashMap<>();
            fc.put("field", key);
            fc.put("before", b);
            fc.put("after", a);
            changes.add(fc);
        }
        return changes;
    }

    /**
     * Dual-write the domain change record (Issue #64 AC6). Runs alongside
     * {@link #writeAudit} during the dual-write period; {@code ci_change_record}
     * becomes the canonical source for CMDB change history / stats.
     */
    private void writeChangeRecord(String tenantId, String action, Long instanceId,
                                   String modelCode, Long operatorId,
                                   List<Map<String, Object>> fieldChanges) {
        CiChangeRecord rec = new CiChangeRecord();
        rec.setTenantId(tenantId);
        rec.setInstanceId(instanceId);
        rec.setModelCode(modelCode);
        rec.setAction(action);
        rec.setFieldChanges(fieldChanges);
        rec.setOperatorId(operatorId != null ? operatorId : 0L);
        rec.setCreatedAt(LocalDateTime.now());
        ciChangeRecordMapper.insert(rec);
    }

    private void writeAudit(String tenantId, String action, Long targetId,
                            String targetType, Long operatorId, String beforeJson, String afterJson) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("cmdb").action(action)
                .targetId(targetId).targetType(targetType)
                .operatorId(operatorId != null ? operatorId : 0L)
                .beforeJson(beforeJson).afterJson(afterJson)
                .createdAt(LocalDateTime.now()).build());
    }
}
