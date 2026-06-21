package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.attributegroup.AttributeGroupVO;
import com.cwgsyw.platform.module.cmdb.dto.attributegroup.CreateAttributeGroupRequest;
import com.cwgsyw.platform.module.cmdb.dto.attributegroup.UpdateAttributeGroupRequest;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiAttributeGroup;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeGroupMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeMapper;
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
public class CiAttributeGroupService {

    private final CiAttributeGroupMapper ciAttributeGroupMapper;
    private final CiAttributeMapper ciAttributeMapper;
    private final CiModelMapper ciModelMapper;
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    public List<AttributeGroupVO> list(String modelCode, String tenantId) {
        CiModel model = loadModel(modelCode, tenantId);
        List<CiAttributeGroup> groups = ciAttributeGroupMapper.selectList(
                new LambdaQueryWrapper<CiAttributeGroup>()
                        .eq(CiAttributeGroup::getTenantId, tenantId)
                        .eq(CiAttributeGroup::getModelId, model.getName())
                        .eq(CiAttributeGroup::getIsDeleted, false)
                        .orderByAsc(CiAttributeGroup::getSortOrder)
                        .orderByAsc(CiAttributeGroup::getId));

        List<CiAttribute> attrs = ciAttributeMapper.selectList(
                new LambdaQueryWrapper<CiAttribute>()
                        .eq(CiAttribute::getTenantId, tenantId)
                        .eq(CiAttribute::getModelId, model.getName())
                        .eq(CiAttribute::getIsDeleted, false));
        Map<String, Long> countByGroupId = attrs.stream()
                .filter(a -> a.getGroupId() != null)
                .collect(Collectors.groupingBy(CiAttribute::getGroupId, Collectors.counting()));

        return groups.stream()
                .map(g -> toVO(g, countByGroupId.getOrDefault(g.getCode(), 0L).intValue()))
                .collect(Collectors.toList());
    }

    @Transactional
    public AttributeGroupVO create(String modelCode, CreateAttributeGroupRequest req,
                                    String tenantId, Long operatorId) {
        CiModel model = loadModel(modelCode, tenantId);

        long dup = ciAttributeGroupMapper.selectCount(new LambdaQueryWrapper<CiAttributeGroup>()
                .eq(CiAttributeGroup::getTenantId, tenantId)
                .eq(CiAttributeGroup::getModelId, model.getName())
                .eq(CiAttributeGroup::getCode, req.getGroupId())
                .eq(CiAttributeGroup::getIsDeleted, false));
        if (dup > 0) {
            throw new IllegalArgumentException("分组编码已存在: " + req.getGroupId());
        }

        CiAttributeGroup g = new CiAttributeGroup();
        g.setTenantId(tenantId);
        g.setModelId(model.getName());
        g.setCode(req.getGroupId());
        g.setName(req.getName());
        g.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0);
        ciAttributeGroupMapper.insert(g);

        writeAudit(tenantId, "create_attribute_group", g.getId(), operatorId, null, snapshot(g));
        return toVO(g, 0);
    }

    @Transactional
    public AttributeGroupVO update(String modelCode, Long id, UpdateAttributeGroupRequest req,
                                    String tenantId, Long operatorId) {
        CiModel model = loadModel(modelCode, tenantId);
        CiAttributeGroup g = loadGroup(id, tenantId, model.getName());

        String before = snapshot(g);
        if (req.getName() != null) g.setName(req.getName());
        if (req.getSortOrder() != null) g.setSortOrder(req.getSortOrder());
        ciAttributeGroupMapper.updateById(g);

        writeAudit(tenantId, "update_attribute_group", id, operatorId, before, snapshot(g));
        long count = ciAttributeMapper.selectCount(new LambdaQueryWrapper<CiAttribute>()
                .eq(CiAttribute::getTenantId, tenantId)
                .eq(CiAttribute::getModelId, model.getName())
                .eq(CiAttribute::getGroupId, g.getCode())
                .eq(CiAttribute::getIsDeleted, false));
        return toVO(g, (int) count);
    }

    @Transactional
    public void delete(String modelCode, Long id, String tenantId, Long operatorId) {
        CiModel model = loadModel(modelCode, tenantId);
        CiAttributeGroup g = loadGroup(id, tenantId, model.getName());

        long attrCount = ciAttributeMapper.selectCount(new LambdaQueryWrapper<CiAttribute>()
                .eq(CiAttribute::getTenantId, tenantId)
                .eq(CiAttribute::getModelId, model.getName())
                .eq(CiAttribute::getGroupId, g.getCode())
                .eq(CiAttribute::getIsDeleted, false));
        if (attrCount > 0) {
            throw new IllegalStateException("分组下尚有 " + attrCount + " 个属性，无法删除");
        }

        String before = snapshot(g);
        g.setDeletedAt(LocalDateTime.now());
        g.setDeletedBy(operatorId);
        ciAttributeGroupMapper.updateById(g);
        ciAttributeGroupMapper.deleteById(id);

        writeAudit(tenantId, "delete_attribute_group", id, operatorId, before, null);
    }

    private CiModel loadModel(String modelCode, String tenantId) {
        return ciModelMapper.findByName(modelCode, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("模型不存在: " + modelCode));
    }

    private CiAttributeGroup loadGroup(Long id, String tenantId, String modelName) {
        CiAttributeGroup g = ciAttributeGroupMapper.selectById(id);
        if (g == null || g.getIsDeleted() || !g.getTenantId().equals(tenantId)
                || !modelName.equals(g.getModelId())) {
            throw new IllegalArgumentException("属性分组不存在");
        }
        return g;
    }

    private AttributeGroupVO toVO(CiAttributeGroup g, int attributeCount) {
        AttributeGroupVO vo = new AttributeGroupVO();
        vo.setId(g.getId());
        vo.setGroupId(g.getCode());
        vo.setName(g.getName());
        vo.setSortOrder(g.getSortOrder());
        vo.setIsBuiltIn(false);
        vo.setAttributeCount(attributeCount);
        vo.setCreatedAt(g.getCreatedAt());
        vo.setUpdatedAt(g.getUpdatedAt());
        return vo;
    }

    /** Returns valid JSON for audit_log.before_json/after_json (which are JSON columns). */
    private String snapshot(CiAttributeGroup g) {
        Map<String, Object> m = new HashMap<>();
        m.put("modelId", g.getModelId());
        m.put("groupId", g.getCode());
        m.put("name", g.getName());
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
                .tenantId(tenantId).module("cmdb_attribute").action(action)
                .targetId(targetId).targetType("ci_attribute_group").operatorId(operatorId)
                .beforeJson(before).afterJson(after).createdAt(LocalDateTime.now()).build());
    }
}
