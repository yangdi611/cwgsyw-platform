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
                .eq(CiInstance::getModelId, model.getName())
                .eq(CiInstance::getName, req.getName())
                .eq(CiInstance::getIsDeleted, false);
        if (ciInstanceMapper.selectCount(nameCheck) > 0) {
            throw new IllegalArgumentException("同模型下实例名称已存在: " + req.getName());
        }

        List<CiAttribute> attrs = ciAttributeMapper.listByModel(model.getName(), tenantId);
        schemaValidator.validate(req.getFieldsData(), attrs);
        uniquenessValidator.validate(req.getFieldsData(), attrs, tenantId, model.getName(), null);

        CiInstance inst = new CiInstance();
        inst.setTenantId(tenantId); inst.setModelId(model.getName());
        inst.setName(req.getName());
        inst.setStatus(req.getStatus() != null ? req.getStatus() : "online");
        inst.setOwner(req.getOwner()); inst.setDescription(req.getDescription());
        inst.setFieldsData(req.getFieldsData());
        ciInstanceMapper.insert(inst);

        writeAudit(tenantId, "create_instance", inst.getId(), "ci_instance",
                operatorId, null, snapshotInstance(inst));
        writeChangeRecord(tenantId, "create", inst.getId(), inst.getModelId(), operatorId,
                diffSnapshots(Map.of(), buildChangeSnapshot(inst)));
        ciChangeService.invalidateStatsCache();
        return ciInstanceQueryService.getDetail(inst.getId(), tenantId);
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
            inst.setFieldsData(merged);

            List<CiAttribute> attrs = ciAttributeMapper.listByModel(inst.getModelId(), tenantId);
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
