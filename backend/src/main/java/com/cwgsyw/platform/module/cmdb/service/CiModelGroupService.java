package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.modelgroup.CreateModelGroupRequest;
import com.cwgsyw.platform.module.cmdb.dto.modelgroup.ModelGroupVO;
import com.cwgsyw.platform.module.cmdb.dto.modelgroup.UpdateModelGroupRequest;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.entity.CiModelGroup;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelGroupMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CiModelGroupService {

    private final CiModelGroupMapper ciModelGroupMapper;
    private final CiModelMapper ciModelMapper;
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    public List<ModelGroupVO> list(String tenantId) {
        List<CiModelGroup> groups = ciModelGroupMapper.selectList(
                new LambdaQueryWrapper<CiModelGroup>()
                        .eq(CiModelGroup::getTenantId, tenantId)
                        .eq(CiModelGroup::getIsDeleted, false)
                        .orderByAsc(CiModelGroup::getSortOrder)
                        .orderByAsc(CiModelGroup::getId));

        List<CiModel> models = ciModelMapper.selectList(
                new LambdaQueryWrapper<CiModel>()
                        .eq(CiModel::getTenantId, tenantId)
                        .eq(CiModel::getIsDeleted, false));
        Map<String, Long> countByCode = models.stream()
                .filter(m -> m.getGroupCode() != null)
                .collect(Collectors.groupingBy(CiModel::getGroupCode, Collectors.counting()));

        return groups.stream().map(g -> toVO(g, countByCode.getOrDefault(g.getCode(), 0L).intValue()))
                .collect(Collectors.toList());
    }

    @Transactional
    public ModelGroupVO create(CreateModelGroupRequest req, String tenantId, Long operatorId) {
        if (ciModelGroupMapper.selectCount(new LambdaQueryWrapper<CiModelGroup>()
                .eq(CiModelGroup::getTenantId, tenantId)
                .eq(CiModelGroup::getCode, req.getCode())
                .eq(CiModelGroup::getIsDeleted, false)) > 0) {
            throw new IllegalArgumentException("分类编码已存在: " + req.getCode());
        }

        CiModelGroup g = new CiModelGroup();
        g.setTenantId(tenantId);
        g.setCode(req.getCode());
        g.setName(req.getName());
        g.setIcon(req.getIcon());
        g.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0);
        g.setIsBuiltIn(false);
        ciModelGroupMapper.insert(g);

        writeAudit(tenantId, "create_model_group", g.getId(), operatorId, null, snapshot(g));
        return toVO(g, 0);
    }

    @Transactional
    public ModelGroupVO update(Long id, UpdateModelGroupRequest req, String tenantId, Long operatorId) {
        CiModelGroup g = loadGroup(id, tenantId);
        String before = snapshot(g);

        if (req.getName() != null) g.setName(req.getName());
        if (req.getIcon() != null) g.setIcon(req.getIcon());
        if (req.getSortOrder() != null) g.setSortOrder(req.getSortOrder());
        ciModelGroupMapper.updateById(g);

        writeAudit(tenantId, "update_model_group", id, operatorId, before, snapshot(g));
        long count = ciModelMapper.selectCount(new LambdaQueryWrapper<CiModel>()
                .eq(CiModel::getTenantId, tenantId)
                .eq(CiModel::getGroupCode, g.getCode())
                .eq(CiModel::getIsDeleted, false));
        return toVO(g, (int) count);
    }

    @Transactional
    public void delete(Long id, String tenantId, Long operatorId) {
        CiModelGroup g = loadGroup(id, tenantId);

        if (Boolean.TRUE.equals(g.getIsBuiltIn())) {
            throw new IllegalStateException("内置分类不可删除");
        }
        long modelCount = ciModelMapper.selectCount(new LambdaQueryWrapper<CiModel>()
                .eq(CiModel::getTenantId, tenantId)
                .eq(CiModel::getGroupCode, g.getCode())
                .eq(CiModel::getIsDeleted, false));
        if (modelCount > 0) {
            throw new IllegalStateException("分类下尚有 " + modelCount + " 个模型，无法删除");
        }

        String before = snapshot(g);
        g.setDeletedAt(LocalDateTime.now());
        g.setDeletedBy(operatorId);
        ciModelGroupMapper.updateById(g);
        ciModelGroupMapper.deleteById(id);

        writeAudit(tenantId, "delete_model_group", id, operatorId, before, null);
    }

    private CiModelGroup loadGroup(Long id, String tenantId) {
        CiModelGroup g = ciModelGroupMapper.selectById(id);
        if (g == null || g.getIsDeleted() || !g.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("模型分类不存在");
        }
        return g;
    }

    private ModelGroupVO toVO(CiModelGroup g, int modelCount) {
        ModelGroupVO vo = new ModelGroupVO();
        vo.setId(g.getId());
        vo.setCode(g.getCode());
        vo.setName(g.getName());
        vo.setIcon(g.getIcon());
        vo.setSortOrder(g.getSortOrder());
        vo.setIsBuiltIn(g.getIsBuiltIn());
        vo.setModelCount(modelCount);
        vo.setCreatedAt(g.getCreatedAt());
        vo.setUpdatedAt(g.getUpdatedAt());
        return vo;
    }

    /** Returns valid JSON for audit_log.before_json/after_json (which are JSON columns). */
    private String snapshot(CiModelGroup g) {
        Map<String, Object> m = new HashMap<>();
        m.put("code", g.getCode());
        m.put("name", g.getName());
        m.put("icon", g.getIcon());
        m.put("sortOrder", g.getSortOrder());
        try {
            return objectMapper.writeValueAsString(m);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private void writeAudit(String tenantId, String action, Long targetId, Long operatorId,
                             String before, String after) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("cmdb_model").action(action)
                .targetId(targetId).targetType("ci_model_group").operatorId(operatorId)
                .beforeJson(before).afterJson(after).createdAt(LocalDateTime.now()).build());
    }
}
