package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.attribute.CiAttributeVO;
import com.cwgsyw.platform.module.cmdb.dto.attribute.CreateAttributeRequest;
import com.cwgsyw.platform.module.cmdb.dto.attribute.UpdateAttributeRequest;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiAttributeGroup;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeGroupMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
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
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    public List<CiAttributeVO> list(String modelId, String tenantId) {
        CiModel model = loadModel(modelId, tenantId);
        Map<String, String> attrGroupNames = resolveAttrGroupNames(tenantId);
        return ciAttributeMapper.listByModel(model.getName(), tenantId).stream()
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
                .eq(CiAttribute::getModelId, model.getName())
                .eq(CiAttribute::getFieldKey, req.getFieldKey())
                .eq(CiAttribute::getIsDeleted, false);
        if (ciAttributeMapper.selectCount(dupCheck) > 0) {
            throw new IllegalArgumentException("字段标识已存在: " + req.getFieldKey());
        }

        if ("enum".equals(req.getFieldType()) && (req.getEnumOptions() == null || req.getEnumOptions().isBlank())) {
            throw new IllegalArgumentException("enum 类型字段必须提供 enumOptions");
        }

        validateAttrGroup(model.getName(), req.getGroupId(), tenantId);

        CiAttribute attr = new CiAttribute();
        attr.setTenantId(tenantId);
        attr.setModelId(model.getName());
        attr.setFieldKey(req.getFieldKey());
        attr.setName(req.getName());
        attr.setGroupId(req.getGroupId());
        attr.setFieldType(req.getFieldType());
        attr.setIsRequired(req.getIsRequired());
        attr.setIsEditable(req.getIsEditable());
        attr.setIsUnique(req.getIsUnique());
        attr.setIsBuiltIn(false);
        attr.setIsListShow(req.getIsListShow());
        attr.setDefaultValue(req.getDefaultValue());
        attr.setEnumOptions(req.getEnumOptions());
        attr.setSortOrder(req.getSortOrder());
        ciAttributeMapper.insert(attr);

        writeAudit(tenantId, "create_attribute", attr.getId(), "ci_attribute",
                operatorId, null, snapshot(attr));

        Map<String, String> attrGroupNames = resolveAttrGroupNames(tenantId);
        return toVO(attr, attrGroupNames);
    }

    @Transactional
    public CiAttributeVO update(String modelId, Long attrId, UpdateAttributeRequest req,
                                String tenantId, Long operatorId) {
        CiModel model = loadModel(modelId, tenantId);
        CiAttribute attr = loadAttribute(attrId, tenantId, model.getName());
        String before = snapshot(attr);

        if (Boolean.TRUE.equals(attr.getIsBuiltIn())) {
            if (req.getName() != null || req.getIsRequired() != null || req.getIsEditable() != null
                    || req.getDefaultValue() != null || req.getEnumOptions() != null || req.getSortOrder() != null) {
                throw new IllegalArgumentException("内置字段仅允许修改 isListShow");
            }
        }

        if (req.getName() != null) attr.setName(req.getName());
        if (req.getIsRequired() != null) attr.setIsRequired(req.getIsRequired());
        if (req.getIsEditable() != null) attr.setIsEditable(req.getIsEditable());
        if (req.getIsListShow() != null) attr.setIsListShow(req.getIsListShow());
        if (req.getDefaultValue() != null) attr.setDefaultValue(req.getDefaultValue());
        if (req.getEnumOptions() != null) attr.setEnumOptions(req.getEnumOptions());
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
        CiAttribute attr = loadAttribute(attrId, tenantId, model.getName());

        if (Boolean.TRUE.equals(attr.getIsBuiltIn())) {
            throw new IllegalStateException("内置字段不可删除");
        }

        String before = snapshot(attr);
        attr.setIsDeleted(true);
        attr.setDeletedAt(LocalDateTime.now());
        attr.setDeletedBy(operatorId);
        ciAttributeMapper.updateById(attr);

        writeAudit(tenantId, "delete_attribute", attrId, "ci_attribute", operatorId, before, null);
    }

    private CiModel loadModel(String modelId, String tenantId) {
        return ciModelMapper.findByName(modelId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("模型不存在: " + modelId));
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
        vo.setDefaultValue(a.getDefaultValue()); vo.setEnumOptions(a.getEnumOptions());
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
}
