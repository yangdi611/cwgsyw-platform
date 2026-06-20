package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.attribute.CiAttributeVO;
import com.cwgsyw.platform.module.cmdb.dto.model.CiModelVO;
import com.cwgsyw.platform.module.cmdb.dto.model.CreateModelRequest;
import com.cwgsyw.platform.module.cmdb.dto.model.UpdateModelRequest;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiAttributeGroup;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.entity.CiModelGroup;
import com.cwgsyw.platform.module.cmdb.mapper.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CiModelService {

    private final CiModelMapper ciModelMapper;
    private final CiModelGroupMapper ciModelGroupMapper;
    private final CiAttributeMapper ciAttributeMapper;
    private final CiAttributeGroupMapper ciAttributeGroupMapper;
    private final CiInstanceMapper ciInstanceMapper;
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    public PageResult<CiModelVO> list(String keyword, String group, int page, int size,
                                      String tenantId) {
        LambdaQueryWrapper<CiModel> query = new LambdaQueryWrapper<CiModel>()
                .eq(CiModel::getTenantId, tenantId)
                .eq(CiModel::getIsDeleted, false)
                .orderByAsc(CiModel::getCreatedAt);

        if (keyword != null && !keyword.isBlank()) {
            query.and(w -> w.like(CiModel::getName, keyword).or().like(CiModel::getDisplayName, keyword));
        }
        if (group != null && !group.isBlank()) {
            LambdaQueryWrapper<CiModelGroup> gq = new LambdaQueryWrapper<CiModelGroup>()
                    .eq(CiModelGroup::getTenantId, tenantId)
                    .eq(CiModelGroup::getCode, group)
                    .eq(CiModelGroup::getIsDeleted, false);
            CiModelGroup mg = ciModelGroupMapper.selectOne(gq);
            if (mg != null) {
                query.eq(CiModel::getGroupId, mg.getId());
            } else {
                return PageResult.of(new Page<>(page, size));
            }
        }

        Page<CiModel> p = ciModelMapper.selectPage(new Page<>(page, size), query);
        Map<Long, String> groupNames = resolveGroupNames(tenantId);
        Map<String, String> attrGroupNames = resolveAttrGroupNames(tenantId);
        return PageResult.of(p.convert(m -> toVO(m, groupNames, attrGroupNames, false)));
    }

    public CiModelVO getById(Long id, String tenantId) {
        CiModel model = loadModel(id, tenantId);
        Map<Long, String> groupNames = resolveGroupNames(tenantId);
        Map<String, String> attrGroupNames = resolveAttrGroupNames(tenantId);
        return toVO(model, groupNames, attrGroupNames, true);
    }

    public CiModelVO getByCode(String modelCode, String tenantId) {
        CiModel model = ciModelMapper.findByName(modelCode, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("模型不存在: " + modelCode));
        Map<Long, String> groupNames = resolveGroupNames(tenantId);
        Map<String, String> attrGroupNames = resolveAttrGroupNames(tenantId);
        return toVO(model, groupNames, attrGroupNames, true);
    }

    @Transactional
    public CiModelVO create(CreateModelRequest req, String tenantId, Long operatorId) {
        ciModelMapper.findByName(req.getName(), tenantId).ifPresent(m -> {
            throw new IllegalArgumentException("模型标识已存在: " + req.getName());
        });
        CiModelGroup modelGroup = findModelGroup(req.getGroup(), tenantId);

        CiModel model = new CiModel();
        model.setTenantId(tenantId);
        model.setName(req.getName());
        model.setDisplayName(req.getDisplayName());
        model.setGroupId(modelGroup.getId());
        model.setIsBuiltIn(false);
        ciModelMapper.insert(model);

        writeAudit(tenantId, "create_model", model.getId(), "ci_model", operatorId, null, snapshot(model));
        return getById(model.getId(), tenantId);
    }

    @Transactional
    public CiModelVO update(Long id, UpdateModelRequest req, String tenantId, Long operatorId) {
        CiModel model = loadModel(id, tenantId);
        String before = snapshot(model);

        if (req.getDisplayName() != null) model.setDisplayName(req.getDisplayName());
        if (req.getGroup() != null) {
            CiModelGroup mg = findModelGroup(req.getGroup(), tenantId);
            model.setGroupId(mg.getId());
        }
        if (req.getColor() != null) model.setColor(req.getColor());
        if (req.getEnable2dView() != null) model.setEnable2dView(req.getEnable2dView());
        ciModelMapper.updateById(model);

        writeAudit(tenantId, "update_model", id, "ci_model", operatorId, before, snapshot(model));
        return getById(id, tenantId);
    }

    @Transactional
    public void delete(Long id, String tenantId, Long operatorId) {
        CiModel model = loadModel(id, tenantId);

        if (Boolean.TRUE.equals(model.getIsBuiltIn())) {
            throw new IllegalStateException("内置模型不可删除");
        }
        long instanceCount = ciInstanceMapper.countByModel(model.getName(), tenantId);
        if (instanceCount > 0) {
            throw new IllegalStateException("模型下存在 " + instanceCount + " 个实例，无法删除");
        }

        String before = snapshot(model);
        model.setIsDeleted(true);
        model.setDeletedAt(LocalDateTime.now());
        model.setDeletedBy(operatorId);
        ciModelMapper.updateById(model);

        List<CiAttribute> attrs = ciAttributeMapper.listByModel(model.getName(), tenantId);
        for (CiAttribute attr : attrs) {
            attr.setIsDeleted(true);
            attr.setDeletedAt(LocalDateTime.now());
            attr.setDeletedBy(operatorId);
            ciAttributeMapper.updateById(attr);
        }

        writeAudit(tenantId, "delete_model", id, "ci_model", operatorId, before, null);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private CiModel loadModel(Long id, String tenantId) {
        CiModel model = ciModelMapper.selectById(id);
        if (model == null || model.getIsDeleted() || !model.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("模型不存在");
        }
        return model;
    }

    private CiModelGroup findModelGroup(String groupCode, String tenantId) {
        LambdaQueryWrapper<CiModelGroup> q = new LambdaQueryWrapper<CiModelGroup>()
                .eq(CiModelGroup::getTenantId, tenantId)
                .eq(CiModelGroup::getCode, groupCode)
                .eq(CiModelGroup::getIsDeleted, false);
        CiModelGroup mg = ciModelGroupMapper.selectOne(q);
        if (mg == null) throw new IllegalArgumentException("模型分组不存在: " + groupCode);
        return mg;
    }

    private Map<Long, String> resolveGroupNames(String tenantId) {
        LambdaQueryWrapper<CiModelGroup> q = new LambdaQueryWrapper<CiModelGroup>()
                .eq(CiModelGroup::getTenantId, tenantId)
                .eq(CiModelGroup::getIsDeleted, false);
        return ciModelGroupMapper.selectList(q).stream()
                .collect(Collectors.toMap(CiModelGroup::getId, CiModelGroup::getName));
    }

    private Map<String, String> resolveAttrGroupNames(String tenantId) {
        LambdaQueryWrapper<CiAttributeGroup> q = new LambdaQueryWrapper<CiAttributeGroup>()
                .eq(CiAttributeGroup::getTenantId, tenantId)
                .eq(CiAttributeGroup::getIsDeleted, false);
        return ciAttributeGroupMapper.selectList(q).stream()
                .collect(Collectors.toMap(g -> g.getModelId() + ":" + g.getCode(), CiAttributeGroup::getName));
    }

    private CiModelVO toVO(CiModel m, Map<Long, String> groupNames,
                           Map<String, String> attrGroupNames, boolean withAttributes) {
        CiModelVO vo = new CiModelVO();
        vo.setId(m.getId());
        vo.setName(m.getName());
        vo.setDisplayName(m.getDisplayName());
        vo.setIsBuiltIn(m.getIsBuiltIn());
        vo.setColor(m.getColor());
        vo.setEnable2dView(m.getEnable2dView());
        vo.setCreatedAt(m.getCreatedAt());
        vo.setUpdatedAt(m.getUpdatedAt());

        if (m.getGroupId() != null) {
            LambdaQueryWrapper<CiModelGroup> gq = new LambdaQueryWrapper<CiModelGroup>()
                    .eq(CiModelGroup::getId, m.getGroupId())
                    .eq(CiModelGroup::getIsDeleted, false);
            CiModelGroup mg = ciModelGroupMapper.selectOne(gq);
            if (mg != null) {
                vo.setGroup(mg.getCode());
                vo.setGroupName(mg.getName());
            }
        }

        long count = ciInstanceMapper.countByModel(m.getName(), m.getTenantId());
        vo.setInstanceCount((int) count);

        if (withAttributes) {
            List<CiAttribute> attrs = ciAttributeMapper.listByModel(m.getName(), m.getTenantId());
            vo.setAttributes(attrs.stream().map(a -> toAttributeVO(a, attrGroupNames)).collect(Collectors.toList()));
        }
        return vo;
    }

    private CiAttributeVO toAttributeVO(CiAttribute a, Map<String, String> attrGroupNames) {
        CiAttributeVO vo = new CiAttributeVO();
        vo.setId(a.getId());
        vo.setModelId(a.getModelId());
        vo.setFieldKey(a.getFieldKey());
        vo.setName(a.getName());
        vo.setGroupId(a.getGroupId());
        vo.setGroupName(attrGroupNames.get(a.getModelId() + ":" + a.getGroupId()));
        vo.setFieldType(a.getFieldType());
        vo.setIsRequired(a.getIsRequired());
        vo.setIsEditable(a.getIsEditable());
        vo.setIsUnique(a.getIsUnique());
        vo.setIsBuiltIn(a.getIsBuiltIn());
        vo.setIsListShow(a.getIsListShow());
        vo.setDefaultValue(a.getDefaultValue());
        vo.setEnumOptions(a.getEnumOptions());
        vo.setSortOrder(a.getSortOrder());
        return vo;
    }

    private String snapshot(CiModel m) {
        try {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", m.getId()); map.put("name", m.getName());
            map.put("displayName", m.getDisplayName());
            map.put("groupId", m.getGroupId()); map.put("isBuiltIn", m.getIsBuiltIn());
            map.put("color", m.getColor()); map.put("enable2dView", m.getEnable2dView());
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
