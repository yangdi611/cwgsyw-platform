package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.association.CiAssociationAttrDefVO;
import com.cwgsyw.platform.module.cmdb.dto.association.CreateAssociationAttrRequest;
import com.cwgsyw.platform.module.cmdb.dto.association.UpdateAssociationAttrRequest;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationAttrDef;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationKind;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationAttrDefMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationKindMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CiAssociationAttrDefService {

    private static final List<String> VALID_FIELD_TYPES = List.of(
            "singlechar", "int", "enum", "list", "bool", "user", "date");

    private final CiAssociationAttrDefMapper ciAssociationAttrDefMapper;
    private final CiAssociationKindMapper ciAssociationKindMapper;
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    public List<CiAssociationAttrDefVO> list(String associationKind, String tenantId) {
        validateAssociationKind(associationKind, tenantId);
        return ciAssociationAttrDefMapper.listByKind(associationKind, tenantId).stream()
                .map(this::toVO).collect(Collectors.toList());
    }

    @Transactional
    public CiAssociationAttrDefVO create(String associationKind, CreateAssociationAttrRequest req,
                                          String tenantId, Long operatorId) {
        validateAssociationKind(associationKind, tenantId);
        validateFieldType(req.getFieldType(), req.getEnumOptions());

        // fieldKey uniqueness check within same association_kind
        LambdaQueryWrapper<CiAssociationAttrDef> dupCheck = new LambdaQueryWrapper<CiAssociationAttrDef>()
                .eq(CiAssociationAttrDef::getTenantId, tenantId)
                .eq(CiAssociationAttrDef::getAssociationKind, associationKind)
                .eq(CiAssociationAttrDef::getFieldKey, req.getFieldKey())
                .eq(CiAssociationAttrDef::getIsDeleted, false);
        if (ciAssociationAttrDefMapper.selectCount(dupCheck) > 0) {
            throw new IllegalArgumentException("同关联类型下字段标识已存在: " + req.getFieldKey());
        }

        CiAssociationAttrDef entity = new CiAssociationAttrDef();
        entity.setTenantId(tenantId);
        entity.setAssociationKind(associationKind);
        entity.setFieldKey(req.getFieldKey());
        entity.setName(req.getName());
        entity.setFieldType(req.getFieldType());
        entity.setIsRequired(req.getIsRequired() != null ? req.getIsRequired() : false);
        entity.setEnumOptions(req.getEnumOptions());
        entity.setDefaultValue(req.getDefaultValue());
        entity.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0);
        ciAssociationAttrDefMapper.insert(entity);

        writeAudit(tenantId, "create_association_attr", entity.getId(), "ci_association_attr_def",
                operatorId, null, snapshot(entity));
        return toVO(entity);
    }

    @Transactional
    public CiAssociationAttrDefVO update(String associationKind, Long attrId,
                                          UpdateAssociationAttrRequest req,
                                          String tenantId, Long operatorId) {
        CiAssociationAttrDef entity = loadAttrDef(attrId, tenantId);
        if (!entity.getAssociationKind().equals(associationKind)) {
            throw new IllegalArgumentException("属性不属于该关联类型");
        }

        String before = snapshot(entity);

        if (req.getName() != null) entity.setName(req.getName());
        if (req.getIsRequired() != null) entity.setIsRequired(req.getIsRequired());
        if (req.getEnumOptions() != null) entity.setEnumOptions(req.getEnumOptions());
        if (req.getDefaultValue() != null) entity.setDefaultValue(req.getDefaultValue());
        if (req.getSortOrder() != null) entity.setSortOrder(req.getSortOrder());

        ciAssociationAttrDefMapper.updateById(entity);

        writeAudit(tenantId, "update_association_attr", attrId, "ci_association_attr_def",
                operatorId, before, snapshot(entity));
        return toVO(entity);
    }

    @Transactional
    public void delete(String associationKind, Long attrId, String tenantId, Long operatorId) {
        CiAssociationAttrDef entity = loadAttrDef(attrId, tenantId);
        if (!entity.getAssociationKind().equals(associationKind)) {
            throw new IllegalArgumentException("属性不属于该关联类型");
        }

        String before = snapshot(entity);

        entity.setIsDeleted(true);
        entity.setDeletedAt(LocalDateTime.now());
        entity.setDeletedBy(operatorId);
        ciAssociationAttrDefMapper.updateById(entity);

        writeAudit(tenantId, "delete_association_attr", attrId, "ci_association_attr_def",
                operatorId, before, null);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private CiAssociationAttrDef loadAttrDef(Long id, String tenantId) {
        CiAssociationAttrDef entity = ciAssociationAttrDefMapper.selectById(id);
        if (entity == null || entity.getIsDeleted() || !entity.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("关联扩展属性不存在");
        }
        return entity;
    }

    private void validateAssociationKind(String kind, String tenantId) {
        LambdaQueryWrapper<CiAssociationKind> q = new LambdaQueryWrapper<CiAssociationKind>()
                .eq(CiAssociationKind::getTenantId, tenantId)
                .eq(CiAssociationKind::getCode, kind)
                .eq(CiAssociationKind::getIsDeleted, false);
        if (ciAssociationKindMapper.selectCount(q) == 0) {
            throw new IllegalArgumentException("关联类型不存在: " + kind);
        }
    }

    private void validateFieldType(String fieldType, String enumOptions) {
        if (!VALID_FIELD_TYPES.contains(fieldType)) {
            throw new IllegalArgumentException("不支持的字段类型: " + fieldType);
        }
        if ("enum".equals(fieldType) && (enumOptions == null || enumOptions.isBlank())) {
            throw new IllegalArgumentException("枚举类型必须提供 enumOptions");
        }
    }

    private CiAssociationAttrDefVO toVO(CiAssociationAttrDef entity) {
        CiAssociationAttrDefVO vo = new CiAssociationAttrDefVO();
        vo.setId(entity.getId());
        vo.setAssociationKind(entity.getAssociationKind());
        vo.setFieldKey(entity.getFieldKey());
        vo.setName(entity.getName());
        vo.setFieldType(entity.getFieldType());
        vo.setIsRequired(entity.getIsRequired());
        vo.setEnumOptions(entity.getEnumOptions());
        vo.setDefaultValue(entity.getDefaultValue());
        vo.setSortOrder(entity.getSortOrder());
        return vo;
    }

    private String snapshot(CiAssociationAttrDef entity) {
        try {
            return objectMapper.writeValueAsString(toVO(entity));
        } catch (Exception e) {
            return "{}";
        }
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
