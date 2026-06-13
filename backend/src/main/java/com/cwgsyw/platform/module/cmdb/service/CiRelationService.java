package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.relation.CiRelationVO;
import com.cwgsyw.platform.module.cmdb.dto.relation.CreateRelationRequest;
import com.cwgsyw.platform.module.cmdb.dto.relation.UpdateRelationRequest;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationAttrDef;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationKind;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiInstanceRel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationAttrDefMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationKindMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceRelMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CiRelationService {

    private final CiInstanceRelMapper ciInstanceRelMapper;
    private final CiInstanceMapper ciInstanceMapper;
    private final CiAssociationKindMapper ciAssociationKindMapper;
    private final CiAssociationAttrDefMapper ciAssociationAttrDefMapper;
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    @Transactional
    public CiRelationVO create(Long srcInstanceId, CreateRelationRequest req, String tenantId, Long operatorId) {
        CiInstance src = loadInstance(srcInstanceId, tenantId);
        CiInstance dst = loadInstance(req.getDstInstanceId(), tenantId);
        validateAssociationKind(req.getAssociationKind(), tenantId);

        LambdaQueryWrapper<CiInstanceRel> dupCheck = new LambdaQueryWrapper<CiInstanceRel>()
                .eq(CiInstanceRel::getTenantId, tenantId)
                .eq(CiInstanceRel::getSrcInstanceId, srcInstanceId)
                .eq(CiInstanceRel::getDstInstanceId, req.getDstInstanceId())
                .eq(CiInstanceRel::getAssociationKind, req.getAssociationKind())
                .eq(CiInstanceRel::getIsDeleted, false);
        if (ciInstanceRelMapper.selectCount(dupCheck) > 0) {
            throw new IllegalArgumentException("关联关系已存在");
        }

        // Validate metadata against association attr def schema
        Map<String, Object> metadata = req.getMetadata() != null ? req.getMetadata() : new LinkedHashMap<>();
        List<CiAssociationAttrDef> attrDefs = ciAssociationAttrDefMapper.listByKind(req.getAssociationKind(), tenantId);
        CiInstanceService.SchemaValidator.validateAssociationAttrs(metadata, attrDefs);

        CiInstanceRel rel = new CiInstanceRel();
        rel.setTenantId(tenantId);
        rel.setSrcInstanceId(srcInstanceId);
        rel.setDstInstanceId(req.getDstInstanceId());
        rel.setAssociationKind(req.getAssociationKind());
        rel.setMetadata(metadata);
        ciInstanceRelMapper.insert(rel);

        writeAudit(tenantId, "create_relation", rel.getId(), "ci_instance_rel",
                operatorId, null, snapshotRelation(rel));

        return toVO(rel, src.getName(), dst.getName());
    }

    @Transactional
    public CiRelationVO update(Long instanceId, Long relationId, UpdateRelationRequest req,
                                String tenantId, Long operatorId) {
        CiInstanceRel rel = ciInstanceRelMapper.selectById(relationId);
        if (rel == null || rel.getIsDeleted() || !rel.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("关联关系不存在");
        }
        // Verify the relation belongs to the specified instance
        if (!rel.getSrcInstanceId().equals(instanceId) && !rel.getDstInstanceId().equals(instanceId)) {
            throw new IllegalArgumentException("关联关系不属于该实例");
        }

        String before = snapshotRelation(rel);

        // Patch merge metadata
        if (req.getMetadata() != null) {
            Map<String, Object> merged = new LinkedHashMap<>();
            if (rel.getMetadata() != null) merged.putAll(rel.getMetadata());
            merged.putAll(req.getMetadata());

            // Validate against schema
            List<CiAssociationAttrDef> attrDefs = ciAssociationAttrDefMapper.listByKind(rel.getAssociationKind(), tenantId);
            CiInstanceService.SchemaValidator.validateAssociationAttrs(merged, attrDefs);

            rel.setMetadata(merged);
            ciInstanceRelMapper.updateById(rel);
        }

        writeAudit(tenantId, "update_relation", rel.getId(), "ci_instance_rel",
                operatorId, before, snapshotRelation(rel));

        CiInstance src = ciInstanceMapper.selectById(rel.getSrcInstanceId());
        CiInstance dst = ciInstanceMapper.selectById(rel.getDstInstanceId());
        return toVO(rel,
                src != null ? src.getName() : "unknown",
                dst != null ? dst.getName() : "unknown");
    }

    @Transactional
    public void delete(Long relationId, String tenantId, Long operatorId) {
        CiInstanceRel rel = ciInstanceRelMapper.selectById(relationId);
        if (rel == null || rel.getIsDeleted() || !rel.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("关联关系不存在");
        }

        String before = snapshotRelation(rel);

        rel.setIsDeleted(true);
        rel.setDeletedAt(LocalDateTime.now());
        rel.setDeletedBy(operatorId);
        ciInstanceRelMapper.updateById(rel);

        writeAudit(tenantId, "delete_relation", relationId, "ci_instance_rel",
                operatorId, before, null);
    }

    public List<CiRelationVO> list(Long instanceId, String kind, String tenantId) {
        LambdaQueryWrapper<CiInstanceRel> query = new LambdaQueryWrapper<CiInstanceRel>()
                .eq(CiInstanceRel::getTenantId, tenantId).eq(CiInstanceRel::getIsDeleted, false)
                .and(w -> w.eq(CiInstanceRel::getSrcInstanceId, instanceId).or().eq(CiInstanceRel::getDstInstanceId, instanceId));
        if (kind != null && !kind.isBlank()) query.eq(CiInstanceRel::getAssociationKind, kind);
        query.orderByDesc(CiInstanceRel::getCreatedAt);

        return ciInstanceRelMapper.selectList(query).stream().map(rel -> {
            CiInstance src = ciInstanceMapper.selectById(rel.getSrcInstanceId());
            CiInstance dst = ciInstanceMapper.selectById(rel.getDstInstanceId());
            return toVO(rel, src != null ? src.getName() : "unknown", dst != null ? dst.getName() : "unknown");
        }).collect(Collectors.toList());
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private CiInstance loadInstance(Long id, String tenantId) {
        CiInstance inst = ciInstanceMapper.selectById(id);
        if (inst == null || inst.getIsDeleted() || !inst.getTenantId().equals(tenantId))
            throw new IllegalArgumentException("实例不存在: " + id);
        return inst;
    }

    private void validateAssociationKind(String kind, String tenantId) {
        LambdaQueryWrapper<CiAssociationKind> q = new LambdaQueryWrapper<CiAssociationKind>()
                .eq(CiAssociationKind::getTenantId, tenantId)
                .eq(CiAssociationKind::getCode, kind).eq(CiAssociationKind::getIsDeleted, false);
        if (ciAssociationKindMapper.selectCount(q) == 0)
            throw new IllegalArgumentException("关联类型不存在: " + kind);
    }

    private CiRelationVO toVO(CiInstanceRel rel, String srcName, String dstName) {
        CiRelationVO vo = new CiRelationVO();
        vo.setId(rel.getId());
        vo.setSrcInstanceId(rel.getSrcInstanceId());
        vo.setSrcInstanceName(srcName);
        vo.setDstInstanceId(rel.getDstInstanceId());
        vo.setDstInstanceName(dstName);
        vo.setAssociationKind(rel.getAssociationKind());
        vo.setMetadata(rel.getMetadata());
        vo.setCreatedAt(rel.getCreatedAt());
        return vo;
    }

    private String snapshotRelation(CiInstanceRel rel) {
        try {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", rel.getId());
            map.put("srcInstanceId", rel.getSrcInstanceId());
            map.put("dstInstanceId", rel.getDstInstanceId());
            map.put("associationKind", rel.getAssociationKind());
            map.put("metadata", rel.getMetadata());
            return objectMapper.writeValueAsString(map);
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
