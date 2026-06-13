package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.*;
import com.cwgsyw.platform.module.cmdb.entity.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CiMetadataService {

    private final CiModelMapper modelMapper;
    private final CiAttributeMapper attributeMapper;
    private final CiAttributeGroupMapper groupMapper;
    private final CiAssociationKindMapper kindMapper;
    private final CiAssociationDefMapper defMapper;
    private final AuditLogMapper auditLogMapper;

    // ── Models ────────────────────────────────────────────────────────────────

    public List<CiModelVO> listModels(String tenantId) {
        return modelMapper.findByTenant(tenantId).stream()
                .map(this::toModelVO).collect(Collectors.toList());
    }

    public CiModelVO getModel(String tenantId, String modelId) {
        CiModel model = findModelOrThrow(tenantId, modelId);
        CiModelVO vo = toModelVO(model);
        vo.setAttributeGroups(groupMapper.findByModel(tenantId, modelId)
                .stream().map(this::toGroupVO).collect(Collectors.toList()));
        vo.setAttributes(attributeMapper.findByModel(tenantId, modelId)
                .stream().map(this::toAttributeVO).collect(Collectors.toList()));
        return vo;
    }

    @Transactional
    public CiModelVO createModel(String tenantId, Long operatorId, SaveCiModelRequest req) {
        if (modelMapper.selectOne(new LambdaQueryWrapper<CiModel>()
                .eq(CiModel::getTenantId, tenantId)
                .eq(CiModel::getModelId, req.getModelId())
                .eq(CiModel::getIsDeleted, false)) != null) {
            throw new IllegalArgumentException("模型ID已存在: " + req.getModelId());
        }
        CiModel model = new CiModel();
        model.setTenantId(tenantId);
        model.setModelId(req.getModelId());
        model.setName(req.getName());
        model.setIcon(req.getIcon());
        model.setGroupCode(req.getGroupCode());
        model.setDescription(req.getDescription());
        model.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0);
        model.setIsBuiltIn(false);
        model.setIsPaused(false);
        model.setCreatedAt(LocalDateTime.now());
        model.setUpdatedAt(LocalDateTime.now());
        model.setCreatedBy(operatorId);
        modelMapper.insert(model);

        CiAttributeGroup defaultGroup = new CiAttributeGroup();
        defaultGroup.setTenantId(tenantId);
        defaultGroup.setModelId(req.getModelId());
        defaultGroup.setGroupId("default");
        defaultGroup.setName("基本信息");
        defaultGroup.setIsDefault(true);
        defaultGroup.setIsBuiltIn(false);
        defaultGroup.setSortOrder(1);
        defaultGroup.setCreatedAt(LocalDateTime.now());
        groupMapper.insert(defaultGroup);

        writeAudit(tenantId, "create_model", model.getId(), operatorId, "model_id=" + req.getModelId());
        return toModelVO(model);
    }

    @Transactional
    public void updateModel(String tenantId, String modelId, Long operatorId, SaveCiModelRequest req) {
        CiModel model = findModelOrThrow(tenantId, modelId);
        modelMapper.update(null, new LambdaUpdateWrapper<CiModel>()
                .eq(CiModel::getTenantId, tenantId)
                .eq(CiModel::getModelId, modelId)
                .set(CiModel::getName, req.getName())
                .set(CiModel::getIcon, req.getIcon())
                .set(CiModel::getGroupCode, req.getGroupCode())
                .set(CiModel::getDescription, req.getDescription())
                .set(CiModel::getSortOrder, req.getSortOrder() != null ? req.getSortOrder() : model.getSortOrder())
                .set(CiModel::getUpdatedAt, LocalDateTime.now()));
        writeAudit(tenantId, "update_model", model.getId(), operatorId, "model_id=" + modelId);
    }

    @Transactional
    public void deleteModel(String tenantId, String modelId, Long operatorId) {
        CiModel model = findModelOrThrow(tenantId, modelId);
        if (Boolean.TRUE.equals(model.getIsBuiltIn())) {
            throw new IllegalArgumentException("内置模型不可删除");
        }
        modelMapper.update(null, new LambdaUpdateWrapper<CiModel>()
                .eq(CiModel::getTenantId, tenantId)
                .eq(CiModel::getModelId, modelId)
                .set(CiModel::getIsDeleted, true)
                .set(CiModel::getUpdatedAt, LocalDateTime.now()));
        writeAudit(tenantId, "delete_model", model.getId(), operatorId, "model_id=" + modelId);
    }

    // ── Attributes ────────────────────────────────────────────────────────────

    @Transactional
    public CiAttributeVO createAttribute(String tenantId, String modelId, Long operatorId, SaveCiAttributeRequest req) {
        findModelOrThrow(tenantId, modelId);
        if (attributeMapper.selectOne(new LambdaQueryWrapper<CiAttribute>()
                .eq(CiAttribute::getTenantId, tenantId)
                .eq(CiAttribute::getModelId, modelId)
                .eq(CiAttribute::getFieldKey, req.getFieldKey())
                .eq(CiAttribute::getIsDeleted, false)) != null) {
            throw new IllegalArgumentException("字段Key已存在: " + req.getFieldKey());
        }
        CiAttribute attr = new CiAttribute();
        attr.setTenantId(tenantId);
        attr.setModelId(modelId);
        attr.setFieldKey(req.getFieldKey());
        attr.setName(req.getName());
        attr.setGroupId(req.getGroupId() != null ? req.getGroupId() : "default");
        attr.setFieldType(req.getFieldType());
        attr.setOption(req.getOption());
        attr.setDefaultVal(req.getDefaultVal());
        attr.setPlaceholder(req.getPlaceholder());
        attr.setUnit(req.getUnit());
        attr.setIsRequired(req.getIsRequired() != null ? req.getIsRequired() : false);
        attr.setIsEditable(req.getIsEditable() != null ? req.getIsEditable() : true);
        attr.setIsUnique(req.getIsUnique() != null ? req.getIsUnique() : false);
        attr.setIsBuiltIn(false);
        attr.setIsListShow(req.getIsListShow() != null ? req.getIsListShow() : true);
        attr.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0);
        attr.setCreatedAt(LocalDateTime.now());
        attr.setUpdatedAt(LocalDateTime.now());
        attr.setCreatedBy(operatorId);
        attributeMapper.insert(attr);
        return toAttributeVO(attr);
    }

    @Transactional
    public void updateAttribute(String tenantId, Long attrId, Long operatorId, SaveCiAttributeRequest req) {
        CiAttribute attr = attributeMapper.selectById(attrId);
        if (attr == null || !attr.getTenantId().equals(tenantId) || Boolean.TRUE.equals(attr.getIsDeleted())) {
            throw new IllegalArgumentException("属性不存在: " + attrId);
        }
        attributeMapper.update(null, new LambdaUpdateWrapper<CiAttribute>()
                .eq(CiAttribute::getId, attrId)
                .set(CiAttribute::getName, req.getName())
                .set(CiAttribute::getGroupId, req.getGroupId())
                .set(CiAttribute::getOption, req.getOption())
                .set(CiAttribute::getPlaceholder, req.getPlaceholder())
                .set(CiAttribute::getUnit, req.getUnit())
                .set(CiAttribute::getIsRequired, req.getIsRequired())
                .set(CiAttribute::getIsListShow, req.getIsListShow())
                .set(CiAttribute::getSortOrder, req.getSortOrder())
                .set(CiAttribute::getUpdatedAt, LocalDateTime.now()));
    }

    @Transactional
    public void deleteAttribute(String tenantId, Long attrId, Long operatorId) {
        CiAttribute attr = attributeMapper.selectById(attrId);
        if (attr == null || !attr.getTenantId().equals(tenantId) || Boolean.TRUE.equals(attr.getIsDeleted())) {
            throw new IllegalArgumentException("属性不存在: " + attrId);
        }
        if (Boolean.TRUE.equals(attr.getIsBuiltIn())) throw new IllegalArgumentException("内置属性不可删除");
        attributeMapper.update(null, new LambdaUpdateWrapper<CiAttribute>()
                .eq(CiAttribute::getId, attrId)
                .set(CiAttribute::getIsDeleted, true)
                .set(CiAttribute::getUpdatedAt, LocalDateTime.now()));
    }

    // ── Association Kinds ─────────────────────────────────────────────────────

    public List<CiAssociationKind> listKinds(String tenantId) {
        return kindMapper.findByTenant(tenantId);
    }

    @Transactional
    public CiAssociationKind createKind(String tenantId, Long operatorId, SaveAssociationKindRequest req) {
        if (kindMapper.selectOne(new LambdaQueryWrapper<CiAssociationKind>()
                .eq(CiAssociationKind::getTenantId, tenantId)
                .eq(CiAssociationKind::getKindId, req.getKindId())
                .eq(CiAssociationKind::getIsDeleted, false)) != null) {
            throw new IllegalArgumentException("关联种类ID已存在: " + req.getKindId());
        }
        CiAssociationKind kind = new CiAssociationKind();
        kind.setTenantId(tenantId);
        kind.setKindId(req.getKindId());
        kind.setName(req.getName());
        kind.setSrcToDst(req.getSrcToDst());
        kind.setDstToSrc(req.getDstToSrc());
        kind.setIsBuiltIn(false);
        kind.setCreatedAt(LocalDateTime.now());
        kindMapper.insert(kind);
        return kind;
    }

    // ── Association Defs ──────────────────────────────────────────────────────

    public List<CiAssociationDef> listDefs(String tenantId) {
        return defMapper.findByTenant(tenantId);
    }

    @Transactional
    public CiAssociationDef createDef(String tenantId, Long operatorId, SaveAssociationDefRequest req) {
        findModelOrThrow(tenantId, req.getSrcModelId());
        findModelOrThrow(tenantId, req.getDstModelId());
        String defId = req.getSrcModelId() + "_" + req.getKindId() + "_" + req.getDstModelId();
        if (defMapper.selectOne(new LambdaQueryWrapper<CiAssociationDef>()
                .eq(CiAssociationDef::getTenantId, tenantId)
                .eq(CiAssociationDef::getDefId, defId)
                .eq(CiAssociationDef::getIsDeleted, false)) != null) {
            throw new IllegalArgumentException("该模型关联已存在: " + defId);
        }
        CiAssociationDef def = new CiAssociationDef();
        def.setTenantId(tenantId);
        def.setDefId(defId);
        def.setKindId(req.getKindId());
        def.setSrcModelId(req.getSrcModelId());
        def.setDstModelId(req.getDstModelId());
        def.setName(req.getName() != null ? req.getName() : defId);
        def.setMapping(req.getMapping() != null ? req.getMapping() : "n:n");
        def.setOnDelete(req.getOnDelete() != null ? req.getOnDelete() : "none");
        def.setIsBuiltIn(false);
        def.setCreatedAt(LocalDateTime.now());
        defMapper.insert(def);
        return def;
    }

    @Transactional
    public void deleteDef(String tenantId, Long defDbId, Long operatorId) {
        CiAssociationDef def = defMapper.selectById(defDbId);
        if (def == null || !def.getTenantId().equals(tenantId) || Boolean.TRUE.equals(def.getIsDeleted())) {
            throw new IllegalArgumentException("模型关联不存在: " + defDbId);
        }
        if (Boolean.TRUE.equals(def.getIsBuiltIn())) throw new IllegalArgumentException("内置关联不可删除");
        defMapper.update(null, new LambdaUpdateWrapper<CiAssociationDef>()
                .eq(CiAssociationDef::getId, defDbId)
                .set(CiAssociationDef::getIsDeleted, true));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private CiModel findModelOrThrow(String tenantId, String modelId) {
        CiModel model = modelMapper.selectOne(new LambdaQueryWrapper<CiModel>()
                .eq(CiModel::getTenantId, tenantId)
                .eq(CiModel::getModelId, modelId)
                .eq(CiModel::getIsDeleted, false));
        if (model == null) throw new IllegalArgumentException("模型不存在: " + modelId);
        return model;
    }

    private CiModelVO toModelVO(CiModel m) {
        CiModelVO vo = new CiModelVO();
        vo.setId(m.getId());
        vo.setModelId(m.getModelId());
        vo.setName(m.getName());
        vo.setIcon(m.getIcon());
        vo.setGroupCode(m.getGroupCode());
        vo.setDescription(m.getDescription());
        vo.setIsBuiltIn(m.getIsBuiltIn());
        vo.setIsPaused(m.getIsPaused());
        vo.setSortOrder(m.getSortOrder());
        vo.setCreatedAt(m.getCreatedAt());
        return vo;
    }

    private CiAttributeGroupVO toGroupVO(CiAttributeGroup g) {
        CiAttributeGroupVO vo = new CiAttributeGroupVO();
        vo.setId(g.getId());
        vo.setGroupId(g.getGroupId());
        vo.setName(g.getName());
        vo.setIsDefault(g.getIsDefault());
        vo.setIsBuiltIn(g.getIsBuiltIn());
        vo.setSortOrder(g.getSortOrder());
        return vo;
    }

    private CiAttributeVO toAttributeVO(CiAttribute a) {
        CiAttributeVO vo = new CiAttributeVO();
        vo.setId(a.getId());
        vo.setModelId(a.getModelId());
        vo.setFieldKey(a.getFieldKey());
        vo.setName(a.getName());
        vo.setGroupId(a.getGroupId());
        vo.setFieldType(a.getFieldType());
        vo.setOption(a.getOption());
        vo.setDefaultVal(a.getDefaultVal());
        vo.setPlaceholder(a.getPlaceholder());
        vo.setUnit(a.getUnit());
        vo.setIsRequired(a.getIsRequired());
        vo.setIsEditable(a.getIsEditable());
        vo.setIsUnique(a.getIsUnique());
        vo.setIsBuiltIn(a.getIsBuiltIn());
        vo.setIsListShow(a.getIsListShow());
        vo.setSortOrder(a.getSortOrder());
        return vo;
    }

    private void writeAudit(String tenantId, String action, Long targetId, Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("cmdb").action(action)
                .targetId(targetId).targetType("ci_model")
                .operatorId(operatorId).remark(remark)
                .createdAt(LocalDateTime.now()).build());
    }
}
