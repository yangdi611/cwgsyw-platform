package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.fasterxml.jackson.core.type.TypeReference;
import com.cwgsyw.platform.module.cmdb.dto.attribute.CiAttributeVO;
import com.cwgsyw.platform.module.cmdb.dto.attribute.CreateAttributeRequest;
import com.cwgsyw.platform.module.cmdb.dto.attribute.UpdateAttributeRequest;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiAttributeGroup;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeGroupMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CiAttributeService {

    private static final Set<String> RESERVED_KEYS = Set.of(
            "id", "model_id", "name", "status", "owner", "description",
            "created_at", "updated_at", "is_deleted", "tenant_id");

    private final CiAttributeMapper ciAttributeMapper;
    private final CiAttributeGroupMapper ciAttributeGroupMapper;
    private final CiModelMapper ciModelMapper;
    private final CiInstanceMapper ciInstanceMapper;
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    public List<CiAttributeVO> list(String modelId, String tenantId) {
        CiModel model = loadModel(modelId, tenantId);
        Map<String, String> attrGroupNames = resolveAttrGroupNames(tenantId);
        return ciAttributeMapper.listByModel(model.getModelId(), tenantId).stream()
                .map(a -> toVO(a, attrGroupNames)).collect(Collectors.toList());
    }

    @Transactional
    public CiAttributeVO create(String modelId, CreateAttributeRequest req,
                                String tenantId, Long operatorId) {
        CiModel model = loadModel(modelId, tenantId);

        if (RESERVED_KEYS.contains(req.getFieldKey())) {
            throw new IllegalArgumentException("字段标识为保留字: " + req.getFieldKey());
        }

        LambdaQueryWrapper<CiAttribute> dupCheck = new LambdaQueryWrapper<CiAttribute>()
                .eq(CiAttribute::getTenantId, tenantId)
                .eq(CiAttribute::getModelId, model.getModelId())
                .eq(CiAttribute::getFieldKey, req.getFieldKey())
                .eq(CiAttribute::getIsDeleted, false);
        if (ciAttributeMapper.selectCount(dupCheck) > 0) {
            throw new IllegalArgumentException("字段标识已存在: " + req.getFieldKey());
        }

        List<Map<String, Object>> normalizedOptions = normalizeOptions(req.getFieldType(), req.getOption(), req.getEnumOptions());

        validateAttrGroup(model.getModelId(), req.getGroupId(), tenantId);

        CiAttribute attr = new CiAttribute();
        attr.setTenantId(tenantId);
        attr.setModelId(model.getModelId());
        attr.setFieldKey(req.getFieldKey());
        attr.setName(req.getName());
        attr.setGroupId(req.getGroupId());
        attr.setFieldType(req.getFieldType());
        attr.setIsRequired(req.getIsRequired());
        attr.setIsEditable(req.getIsEditable());
        attr.setIsUnique(req.getIsUnique());
        attr.setIsBuiltIn(false);
        attr.setIsListShow(req.getIsListShow());
        attr.setIsDrawerShow(req.getIsDrawerShow());
        attr.setDefaultValue(req.getDefaultValue());
        attr.setEnumOptions(req.getEnumOptions());
        // Parse enumOptions to option JSONB format
        if (normalizedOptions != null) attr.setOption(normalizedOptions);
        else if (isNonEmptyOption(req.getOption())) attr.setOption(req.getOption());
        attr.setSortOrder(req.getSortOrder());
        insertAttribute(attr);

        writeAudit(tenantId, "create_attribute", attr.getId(), "ci_attribute",
                operatorId, null, snapshot(attr));

        Map<String, String> attrGroupNames = resolveAttrGroupNames(tenantId);
        return toVO(attr, attrGroupNames);
    }

    @Transactional
    public CiAttributeVO update(String modelId, Long attrId, UpdateAttributeRequest req,
                                String tenantId, Long operatorId) {
        CiModel model = loadModel(modelId, tenantId);
        CiAttribute attr = loadAttribute(attrId, tenantId, model.getModelId());
        String before = snapshot(attr);
        Object nextOption = req.getOption();
        if (req.getEnumOptions() != null && (nextOption == null || !isNonEmptyOption(nextOption))) {
            nextOption = req.getEnumOptions();
        }
        List<Map<String, Object>> normalizedOptions = null;
        if (nextOption != null) {
            normalizedOptions = normalizeOptions(attr.getFieldType(), nextOption,
                    nextOption instanceof String ? (String) nextOption : null);
            validateOptionReferences(attr, normalizedOptions, tenantId, model.getModelId());
        }

        // 内置字段的 fieldKey / fieldType / isUnique 由代码常量依赖（如 PrometheusAlertSyncService 按 inner_ip
        // 匹配主机），UpdateAttributeRequest 本身不暴露这些字段，因此其余字段（name/isRequired/isEditable/
        // isListShow/defaultValue/enumOptions/option/sortOrder）允许自由修改。

        if (req.getName() != null) attr.setName(req.getName());
        if (req.getIsRequired() != null) attr.setIsRequired(req.getIsRequired());
        if (req.getIsEditable() != null) attr.setIsEditable(req.getIsEditable());
        if (req.getIsListShow() != null) attr.setIsListShow(req.getIsListShow());
        if (req.getIsDrawerShow() != null) attr.setIsDrawerShow(req.getIsDrawerShow());
        if (req.getDefaultValue() != null) attr.setDefaultValue(req.getDefaultValue());
        if (normalizedOptions != null) attr.setOption(normalizedOptions);
        else if (req.getOption() != null) attr.setOption(req.getOption());
        if (req.getSortOrder() != null) attr.setSortOrder(req.getSortOrder());
        ciAttributeMapper.updateById(attr);

        writeAudit(tenantId, "update_attribute", attrId, "ci_attribute",
                operatorId, before, snapshot(attr));

        Map<String, String> attrGroupNames = resolveAttrGroupNames(tenantId);
        return toVO(attr, attrGroupNames);
    }

    @Transactional
    public void delete(String modelId, Long attrId, String tenantId, Long operatorId) {
        CiModel model = loadModel(modelId, tenantId);
        CiAttribute attr = loadAttribute(attrId, tenantId, model.getModelId());

        if (Boolean.TRUE.equals(attr.getIsBuiltIn())) {
            throw new IllegalStateException("内置字段不可删除");
        }

        String before = snapshot(attr);
        attr.setDeletedAt(LocalDateTime.now());
        attr.setDeletedBy(operatorId);
        ciAttributeMapper.updateById(attr);
        // @TableLogic fields are skipped by updateById — use deleteById to flip is_deleted
        ciAttributeMapper.deleteById(attrId);

        writeAudit(tenantId, "delete_attribute", attrId, "ci_attribute", operatorId, before, null);
    }

    private CiModel loadModel(String modelId, String tenantId) {
        return ciModelMapper.findByName(modelId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("模型不存在: " + modelId));
    }

    private void insertAttribute(CiAttribute attr) {
        try {
            ciAttributeMapper.insert(attr);
        } catch (DuplicateKeyException e) {
            throw new IllegalStateException("字段标识已存在: " + attr.getFieldKey(), e);
        }
    }

    private CiAttribute loadAttribute(Long attrId, String tenantId, String modelName) {
        CiAttribute attr = ciAttributeMapper.selectById(attrId);
        if (attr == null || attr.getIsDeleted() || !attr.getTenantId().equals(tenantId) || !attr.getModelId().equals(modelName)) {
            throw new IllegalArgumentException("字段不存在");
        }
        return attr;
    }

    private void validateAttrGroup(String modelId, String groupCode, String tenantId) {
        LambdaQueryWrapper<CiAttributeGroup> q = new LambdaQueryWrapper<CiAttributeGroup>()
                .eq(CiAttributeGroup::getTenantId, tenantId)
                .eq(CiAttributeGroup::getModelId, modelId)
                .eq(CiAttributeGroup::getCode, groupCode)
                .eq(CiAttributeGroup::getIsDeleted, false);
        if (ciAttributeGroupMapper.selectCount(q) == 0) {
            throw new IllegalArgumentException("属性分组不存在: " + groupCode);
        }
    }

    private Map<String, String> resolveAttrGroupNames(String tenantId) {
        LambdaQueryWrapper<CiAttributeGroup> q = new LambdaQueryWrapper<CiAttributeGroup>()
                .eq(CiAttributeGroup::getTenantId, tenantId)
                .eq(CiAttributeGroup::getIsDeleted, false);
        return ciAttributeGroupMapper.selectList(q).stream()
                .collect(Collectors.toMap(g -> g.getModelId() + ":" + g.getCode(), CiAttributeGroup::getName));
    }

    private CiAttributeVO toVO(CiAttribute a, Map<String, String> attrGroupNames) {
        CiAttributeVO vo = new CiAttributeVO();
        vo.setId(a.getId()); vo.setModelId(a.getModelId()); vo.setFieldKey(a.getFieldKey());
        vo.setName(a.getName()); vo.setGroupId(a.getGroupId());
        vo.setGroupName(attrGroupNames.get(a.getModelId() + ":" + a.getGroupId()));
        vo.setFieldType(a.getFieldType()); vo.setIsRequired(a.getIsRequired());
        vo.setIsEditable(a.getIsEditable()); vo.setIsUnique(a.getIsUnique());
        vo.setIsBuiltIn(a.getIsBuiltIn()); vo.setIsListShow(a.getIsListShow());
        vo.setIsDrawerShow(a.getIsDrawerShow());
        vo.setDefaultValue(a.getDefaultValue()); vo.setEnumOptions(a.getEnumOptions());
        vo.setOption(a.getOption());
        vo.setSortOrder(a.getSortOrder());
        return vo;
    }

    private String snapshot(CiAttribute a) {
        try {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", a.getId()); map.put("modelId", a.getModelId());
            map.put("fieldKey", a.getFieldKey()); map.put("name", a.getName());
            map.put("fieldType", a.getFieldType()); map.put("isRequired", a.getIsRequired());
            map.put("isUnique", a.getIsUnique()); map.put("sortOrder", a.getSortOrder());
            map.put("option", a.getOption());
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) { return "{}"; }
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

    /** option 现为 Object：List（enum 数组）非空、Map（table 对象 schema）非空均视为有效。 */
    private boolean isNonEmptyOption(Object option) {
        if (option == null) return false;
        if (option instanceof Collection<?> c) return !c.isEmpty();
        if (option instanceof Map<?, ?> m) return !m.isEmpty();
        return true;
    }

    private List<Map<String, Object>> normalizeOptions(String fieldType, Object option, String enumOptions) {
        if (!"enum".equals(fieldType) && !"enummulti".equals(fieldType)) return null;
        Object source = isNonEmptyOption(option) ? option : enumOptions;
        if (source == null || (source instanceof String s && s.isBlank())) {
            throw new IllegalArgumentException(fieldType + " 类型字段必须提供选项");
        }
        try {
            List<?> raw = source instanceof String s
                    ? objectMapper.readValue(s, new TypeReference<List<Map<String, Object>>>() {})
                    : (List<?>) source;
            if (raw.isEmpty()) throw new IllegalArgumentException(fieldType + " 类型字段必须提供选项");
            Set<String> ids = new HashSet<>();
            List<Map<String, Object>> normalized = new ArrayList<>();
            for (Object item : raw) {
                if (!(item instanceof Map<?, ?> map)) throw new IllegalArgumentException("枚举选项格式无效");
                Object rawId = map.get("id");
                String id = rawId == null ? "" : rawId.toString().trim();
                if (id.isBlank() || !ids.add(id)) throw new IllegalArgumentException("枚举选项 id 不可为空或重复: " + id);
                Map<String, Object> copy = new LinkedHashMap<>();
                map.forEach((key, value) -> copy.put(String.valueOf(key), value));
                copy.put("id", id);
                normalized.add(copy);
            }
            return normalized;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("枚举选项格式无效，应为 JSON 数组");
        }
    }

    private void validateOptionReferences(CiAttribute attr, List<Map<String, Object>> nextOptions,
                                          String tenantId, String modelId) {
        Set<String> validIds = nextOptions.stream().map(item -> String.valueOf(item.get("id"))).collect(Collectors.toSet());
        LambdaQueryWrapper<CiInstance> query = new LambdaQueryWrapper<CiInstance>()
                .eq(CiInstance::getTenantId, tenantId)
                .eq(CiInstance::getModelId, modelId)
                .eq(CiInstance::getIsDeleted, false);
        for (CiInstance instance : ciInstanceMapper.selectList(query)) {
            Object raw = instance.getFieldsData() == null ? null : instance.getFieldsData().get(attr.getFieldKey());
            if (raw == null) continue;
            if ("enum".equals(attr.getFieldType()) && !validIds.contains(String.valueOf(raw))) {
                throw new IllegalStateException("枚举字段仍被实例使用，不能删除选项: " + raw);
            }
            if ("enummulti".equals(attr.getFieldType()) && raw instanceof String json) {
                try {
                    for (String id : objectMapper.readValue(json, new TypeReference<List<String>>() {})) {
                        if (!validIds.contains(id)) throw new IllegalStateException("多选枚举字段仍被实例使用，不能删除选项: " + id);
                    }
                } catch (IllegalStateException e) {
                    throw e;
                } catch (Exception e) {
                    throw new IllegalStateException("多选枚举字段实例值格式无效，不能修改选项");
                }
            }
        }
    }
}
