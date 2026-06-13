package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.attribute.CiAttributeVO;
import com.cwgsyw.platform.module.cmdb.dto.history.ChangeHistoryVO;
import com.cwgsyw.platform.module.cmdb.dto.instance.*;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationAttrDef;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiAttributeGroup;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiInstanceRel;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.*;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CiInstanceService {

    private final CiInstanceMapper ciInstanceMapper;
    private final CiModelMapper ciModelMapper;
    private final CiAttributeMapper ciAttributeMapper;
    private final CiAttributeGroupMapper ciAttributeGroupMapper;
    private final CiInstanceRelMapper ciInstanceRelMapper;
    private final AuditLogMapper auditLogMapper;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;
    private final CiNotificationService ciNotificationService;

    public PageResult<CiInstanceVO> list(String model, String keyword, String status,
                                         int page, int size, String tenantId) {
        CiModel ciModel = loadModel(model, tenantId);

        LambdaQueryWrapper<CiInstance> query = new LambdaQueryWrapper<CiInstance>()
                .eq(CiInstance::getTenantId, tenantId)
                .eq(CiInstance::getModelId, ciModel.getName())
                .eq(CiInstance::getIsDeleted, false)
                .orderByDesc(CiInstance::getUpdatedAt);

        if (keyword != null && !keyword.isBlank()) {
            query.and(w -> w.like(CiInstance::getName, keyword));
        }
        if (status != null && !status.isBlank()) {
            query.eq(CiInstance::getStatus, status);
        }

        Page<CiInstance> p = ciInstanceMapper.selectPage(new Page<>(page, size), query);

        Set<String> listShowKeys = ciAttributeMapper.listByModel(ciModel.getName(), tenantId).stream()
                .filter(a -> Boolean.TRUE.equals(a.getIsListShow()))
                .map(CiAttribute::getFieldKey).collect(Collectors.toSet());

        return PageResult.of(p.convert(inst -> toListVO(inst, ciModel.getDisplayName(), listShowKeys)));
    }

    public CiInstanceDetailVO getDetail(Long id, String tenantId) {
        CiInstance inst = loadInstance(id, tenantId);
        CiModel model = loadModel(inst.getModelId(), tenantId);
        Map<String, String> attrGroupNames = resolveAttrGroupNames(tenantId);

        List<CiAttributeVO> attrVOs = ciAttributeMapper.listByModel(model.getName(), tenantId).stream()
                .map(a -> toAttributeVO(a, attrGroupNames)).collect(Collectors.toList());

        CiInstanceDetailVO vo = new CiInstanceDetailVO();
        vo.setId(inst.getId()); vo.setName(inst.getName());
        vo.setModelId(inst.getModelId()); vo.setModelName(model.getDisplayName());
        vo.setStatus(inst.getStatus()); vo.setOwner(inst.getOwner());
        vo.setDescription(inst.getDescription()); vo.setFieldsData(inst.getFieldsData());
        vo.setAttributes(attrVOs); vo.setCreatedAt(inst.getCreatedAt()); vo.setUpdatedAt(inst.getUpdatedAt());
        return vo;
    }

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
        SchemaValidator.validate(req.getFieldsData(), attrs);
        validateUniqueFields(req.getFieldsData(), attrs, tenantId, model.getName(), null);

        CiInstance inst = new CiInstance();
        inst.setTenantId(tenantId); inst.setModelId(model.getName());
        inst.setName(req.getName());
        inst.setStatus(req.getStatus() != null ? req.getStatus() : "online");
        inst.setOwner(req.getOwner()); inst.setDescription(req.getDescription());
        inst.setFieldsData(req.getFieldsData());
        ciInstanceMapper.insert(inst);

        writeAudit(tenantId, "create_instance", inst.getId(), "ci_instance",
                operatorId, null, snapshotInstance(inst));
        return getDetail(inst.getId(), tenantId);
    }

    @Transactional
    public CiInstanceDetailVO update(Long id, UpdateInstanceRequest req, String tenantId, Long operatorId) {
        CiInstance inst = loadInstance(id, tenantId);
        String before = snapshotInstance(inst);
        String oldStatus = inst.getStatus();

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
            SchemaValidator.validate(inst.getFieldsData(), attrs);
            validateUniqueFields(inst.getFieldsData(), attrs, tenantId, inst.getModelId(), id);
        }

        ciInstanceMapper.updateById(inst);

        if (req.getStatus() != null && !oldStatus.equals(req.getStatus())) {
            ciNotificationService.notifyStatusChange(inst, oldStatus, req.getStatus(), operatorId);
        }

        writeAudit(tenantId, "update_instance", id, "ci_instance", operatorId, before, snapshotInstance(inst));
        return getDetail(id, tenantId);
    }

    @Transactional
    public void delete(Long id, String tenantId, Long operatorId) {
        CiInstance inst = loadInstance(id, tenantId);
        String before = snapshotInstance(inst);

        inst.setIsDeleted(true); inst.setDeletedAt(LocalDateTime.now()); inst.setDeletedBy(operatorId);
        ciInstanceMapper.updateById(inst);

        LambdaQueryWrapper<CiInstanceRel> relQuery = new LambdaQueryWrapper<CiInstanceRel>()
                .eq(CiInstanceRel::getTenantId, tenantId).eq(CiInstanceRel::getIsDeleted, false)
                .and(w -> w.eq(CiInstanceRel::getSrcInstanceId, id).or().eq(CiInstanceRel::getDstInstanceId, id));
        List<CiInstanceRel> rels = ciInstanceRelMapper.selectList(relQuery);
        for (CiInstanceRel rel : rels) {
            rel.setIsDeleted(true); rel.setDeletedAt(LocalDateTime.now()); rel.setDeletedBy(operatorId);
            ciInstanceRelMapper.updateById(rel);
        }

        ciNotificationService.notifyDelete(inst, operatorId);

        writeAudit(tenantId, "delete_instance", id, "ci_instance", operatorId, before, null);
    }

    public PageResult<CiInstanceSearchVO> search(String keyword, int size, String tenantId) {
        LambdaQueryWrapper<CiInstance> query = new LambdaQueryWrapper<CiInstance>()
                .eq(CiInstance::getTenantId, tenantId).eq(CiInstance::getIsDeleted, false)
                .like(CiInstance::getName, keyword).orderByDesc(CiInstance::getUpdatedAt)
                .last("LIMIT " + size);

        List<CiInstance> records = ciInstanceMapper.selectList(query);
        Map<String, String> modelNames = new HashMap<>();
        for (CiInstance inst : records) {
            if (!modelNames.containsKey(inst.getModelId())) {
                ciModelMapper.findByName(inst.getModelId(), tenantId)
                        .ifPresent(m -> modelNames.put(m.getName(), m.getDisplayName()));
            }
        }

        List<CiInstanceSearchVO> vos = records.stream().map(inst -> {
            CiInstanceSearchVO vo = new CiInstanceSearchVO();
            vo.setId(inst.getId()); vo.setName(inst.getName());
            vo.setModelId(inst.getModelId());
            vo.setModelName(modelNames.getOrDefault(inst.getModelId(), inst.getModelId()));
            return vo;
        }).collect(Collectors.toList());

        PageResult<CiInstanceSearchVO> result = new PageResult<>();
        result.setRecords(vos); result.setTotal(vos.size()); result.setPage(1); result.setSize(size);
        return result;
    }

    public PageResult<ChangeHistoryVO> getInstanceHistory(Long instanceId, int page, int size, String tenantId) {
        Page<AuditLog> result = auditLogMapper.queryPage(new Page<>(page, size), tenantId, "cmdb", null, null, null);

        List<AuditLog> filtered = result.getRecords().stream()
                .filter(a -> "ci_instance".equals(a.getTargetType()) && instanceId.equals(a.getTargetId()))
                .collect(Collectors.toList());

        Map<Long, String> operatorNames = resolveUserNames(filtered.stream()
                .map(AuditLog::getOperatorId).filter(id -> id != null && id > 0).collect(Collectors.toSet()));

        List<ChangeHistoryVO> historyVOs = filtered.stream().map(a -> {
            ChangeHistoryVO vo = new ChangeHistoryVO();
            vo.setId(a.getId()); vo.setAction(a.getAction()); vo.setOperatorId(a.getOperatorId());
            vo.setOperatorName(operatorNames.getOrDefault(a.getOperatorId(), "系统"));
            vo.setBeforeJson(parseJson(a.getBeforeJson())); vo.setAfterJson(parseJson(a.getAfterJson()));
            vo.setCreatedAt(a.getCreatedAt());
            return vo;
        }).collect(Collectors.toList());

        PageResult<ChangeHistoryVO> pr = new PageResult<>();
        pr.setRecords(historyVOs); pr.setTotal(result.getTotal()); pr.setPage(page); pr.setSize(size);
        return pr;
    }

    public PageResult<ChangeHistoryVO> getGlobalChanges(String model, Long operatorId,
            String startDate, String endDate, int page, int size, String tenantId) {
        Page<AuditLog> result = auditLogMapper.queryPage(new Page<>(page, size), tenantId, "cmdb", operatorId, startDate, endDate);

        Map<Long, String> operatorNames = resolveUserNames(result.getRecords().stream()
                .map(AuditLog::getOperatorId).filter(id -> id != null && id > 0).collect(Collectors.toSet()));

        List<ChangeHistoryVO> vos = result.getRecords().stream()
                .filter(a -> a.getTargetType() != null && a.getTargetType().startsWith("ci_"))
                .map(a -> {
                    ChangeHistoryVO vo = new ChangeHistoryVO();
                    vo.setId(a.getId()); vo.setAction(a.getAction()); vo.setOperatorId(a.getOperatorId());
                    vo.setOperatorName(operatorNames.getOrDefault(a.getOperatorId(), "系统"));
                    vo.setBeforeJson(parseJson(a.getBeforeJson())); vo.setAfterJson(parseJson(a.getAfterJson()));
                    vo.setCreatedAt(a.getCreatedAt());
                    return vo;
                }).collect(Collectors.toList());

        PageResult<ChangeHistoryVO> pr = new PageResult<>();
        pr.setRecords(vos); pr.setTotal(result.getTotal()); pr.setPage(page); pr.setSize(size);
        return pr;
    }

    // ─── Schema Validator ──────────────────────────────────────────────────────

    public static class SchemaValidator {
        public static void validate(Map<String, Object> fieldsData, List<CiAttribute> attributes) {
            if (fieldsData == null) fieldsData = Map.of();
            for (CiAttribute attr : attributes) {
                Object value = fieldsData.get(attr.getFieldKey());
                if (Boolean.TRUE.equals(attr.getIsRequired()) && value == null) {
                    throw new IllegalArgumentException("必填字段缺失: " + attr.getName());
                }
                if (value == null) continue;
                validateFieldType(attr.getName(), attr.getFieldType(), attr.getEnumOptions(), value);
            }
        }

        /**
         * Validate metadata fields against association attribute definitions.
         * Reuses the same type-checking logic as instance attribute validation.
         */
        public static void validateAssociationAttrs(Map<String, Object> metadata, List<CiAssociationAttrDef> attrDefs) {
            if (metadata == null) metadata = Map.of();
            for (CiAssociationAttrDef attr : attrDefs) {
                Object value = metadata.get(attr.getFieldKey());
                if (Boolean.TRUE.equals(attr.getIsRequired()) && value == null) {
                    throw new IllegalArgumentException("必填字段缺失: " + attr.getName());
                }
                if (value == null) continue;
                validateFieldType(attr.getName(), attr.getFieldType(), attr.getEnumOptions(), value);
            }
        }

        private static void validateFieldType(String name, String fieldType, String enumOptions, Object value) {
            switch (fieldType) {
                case "singlechar", "user", "date" -> {
                    if (!(value instanceof String))
                        throw new IllegalArgumentException("字段 " + name + " 应为字符串类型");
                }
                case "int" -> {
                    if (!(value instanceof Number))
                        throw new IllegalArgumentException("字段 " + name + " 应为整数类型");
                }
                case "bool" -> {
                    if (!(value instanceof Boolean))
                        throw new IllegalArgumentException("字段 " + name + " 应为布尔类型");
                }
                case "enum" -> {
                    if (!(value instanceof String enumVal))
                        throw new IllegalArgumentException("字段 " + name + " 应为字符串类型");
                    if (enumOptions != null) {
                        try {
                            List<String> options = new ObjectMapper().readValue(enumOptions, new TypeReference<>() {});
                            if (!options.contains(enumVal))
                                throw new IllegalArgumentException("字段 " + name + " 的值不在可选范围内: " + enumVal);
                        } catch (IllegalArgumentException e) { throw e; } catch (Exception ignored) {}
                    }
                }
                case "list" -> {
                    if (!(value instanceof List))
                        throw new IllegalArgumentException("字段 " + name + " 应为列表类型");
                }
                default -> {}
            }
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private CiModel loadModel(String modelId, String tenantId) {
        return ciModelMapper.findByName(modelId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("模型不存在: " + modelId));
    }

    private CiInstance loadInstance(Long id, String tenantId) {
        CiInstance inst = ciInstanceMapper.selectById(id);
        if (inst == null || inst.getIsDeleted() || !inst.getTenantId().equals(tenantId))
            throw new IllegalArgumentException("实例不存在");
        return inst;
    }

    private void validateUniqueFields(Map<String, Object> fieldsData, List<CiAttribute> attrs,
                                       String tenantId, String modelId, Long excludeId) {
        for (CiAttribute attr : attrs) {
            if (!Boolean.TRUE.equals(attr.getIsUnique())) continue;
            Object value = fieldsData.get(attr.getFieldKey());
            if (value == null) continue;
            LambdaQueryWrapper<CiInstance> q = new LambdaQueryWrapper<CiInstance>()
                    .eq(CiInstance::getTenantId, tenantId).eq(CiInstance::getModelId, modelId)
                    .eq(CiInstance::getIsDeleted, false)
                    .apply("fields_data->>'" + attr.getFieldKey() + "' = {0}", value.toString());
            if (excludeId != null) q.ne(CiInstance::getId, excludeId);
            if (ciInstanceMapper.selectCount(q) > 0)
                throw new IllegalArgumentException("字段 " + attr.getName() + " 的值已存在: " + value);
        }
    }

    private Map<String, String> resolveAttrGroupNames(String tenantId) {
        LambdaQueryWrapper<CiAttributeGroup> q = new LambdaQueryWrapper<CiAttributeGroup>()
                .eq(CiAttributeGroup::getTenantId, tenantId).eq(CiAttributeGroup::getIsDeleted, false);
        return ciAttributeGroupMapper.selectList(q).stream()
                .collect(Collectors.toMap(g -> g.getModelId() + ":" + g.getCode(), CiAttributeGroup::getName));
    }

    private Map<Long, String> resolveUserNames(Set<Long> userIds) {
        if (userIds.isEmpty()) return Map.of();
        return userMapper.selectBatchIds(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u.getRealName() != null ? u.getRealName() : u.getUsername(), (a, b) -> a));
    }

    private CiAttributeVO toAttributeVO(CiAttribute a, Map<String, String> attrGroupNames) {
        CiAttributeVO vo = new CiAttributeVO();
        vo.setId(a.getId()); vo.setModelId(a.getModelId()); vo.setFieldKey(a.getFieldKey());
        vo.setName(a.getName()); vo.setGroupId(a.getGroupId());
        vo.setGroupName(attrGroupNames.get(a.getModelId() + ":" + a.getGroupId()));
        vo.setFieldType(a.getFieldType()); vo.setIsRequired(a.getIsRequired());
        vo.setIsEditable(a.getIsEditable()); vo.setIsUnique(a.getIsUnique());
        vo.setIsBuiltIn(a.getIsBuiltIn()); vo.setIsListShow(a.getIsListShow());
        vo.setDefaultValue(a.getDefaultValue()); vo.setEnumOptions(a.getEnumOptions());
        vo.setSortOrder(a.getSortOrder());
        return vo;
    }

    private CiInstanceVO toListVO(CiInstance inst, String modelName, Set<String> listShowKeys) {
        CiInstanceVO vo = new CiInstanceVO();
        vo.setId(inst.getId()); vo.setName(inst.getName()); vo.setModelId(inst.getModelId());
        vo.setModelName(modelName); vo.setStatus(inst.getStatus());
        vo.setOwner(inst.getOwner()); vo.setDescription(inst.getDescription());
        if (inst.getFieldsData() != null && !listShowKeys.isEmpty()) {
            Map<String, Object> filtered = new LinkedHashMap<>();
            for (String key : listShowKeys) {
                if (inst.getFieldsData().containsKey(key)) filtered.put(key, inst.getFieldsData().get(key));
            }
            vo.setFieldsData(filtered);
        }
        vo.setCreatedAt(inst.getCreatedAt()); vo.setUpdatedAt(inst.getUpdatedAt());
        return vo;
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

    private Map<String, Object> parseJson(String json) {
        if (json == null || json.isBlank()) return null;
        try { return objectMapper.readValue(json, new TypeReference<>() {}); }
        catch (Exception e) { return null; }
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
