package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.relation.CiRelationVO;
import com.cwgsyw.platform.module.cmdb.dto.relation.CreateRelationRequest;
import com.cwgsyw.platform.module.cmdb.dto.relation.UpdateRelationRequest;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationAttrDef;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationDef;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiInstanceRel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationAttrDefMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationDefMapper;
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
    private final CiAssociationDefMapper ciAssociationDefMapper;
    private final CiAssociationAttrDefMapper ciAssociationAttrDefMapper;
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;
    private final CiFieldSchemaValidator ciFieldSchemaValidator;

    /**
     * AssociationDef 驱动的关联创建（Spec §4.4 / AD-3）。
     *
     * <p>校验链：defId 存在 → src/dst 实例模型匹配 def.srcModelId/dstModelId →
     * 同向去重 → mapping 基数未超限（1:1）→ metadata 按 def.kindId 的 attr schema 校验 →
     * 写入 ci_instance_rel → 写 audit_log。任一校验失败抛 IllegalArgumentException（可读消息）。
     */
    @Transactional
    public CiRelationVO create(Long srcInstanceId, CreateRelationRequest req, String tenantId, Long operatorId) {
        CiInstance src = loadInstance(srcInstanceId, tenantId);
        CiInstance dst = loadInstance(req.getDstInstanceId(), tenantId);

        // 解析目标 def：canonical defId 优先；缺失时按 AD-3 兼容策略由 associationKind 推导。
        CiAssociationDef def = resolveDef(req, src, dst, tenantId);
        String defId = def.getDefId();

        // 校验 src/dst 模型与 def 端点匹配（方向：src→dst 必须与 def 一致）。
        if (!def.getSrcModelId().equals(src.getModelId()) || !def.getDstModelId().equals(dst.getModelId())) {
            throw new IllegalArgumentException(
                    "关联定义 " + defId + " 要求模型 " + def.getSrcModelId() + " → " + def.getDstModelId()
                            + "，但实例为 " + src.getModelId() + " → " + dst.getModelId());
        }

        // 同向精确去重（DB 唯一索引兜底，此处给出可读错误）。
        LambdaQueryWrapper<CiInstanceRel> dupCheck = new LambdaQueryWrapper<CiInstanceRel>()
                .eq(CiInstanceRel::getTenantId, tenantId)
                .eq(CiInstanceRel::getDefId, defId)
                .eq(CiInstanceRel::getSrcInstanceId, srcInstanceId)
                .eq(CiInstanceRel::getDstInstanceId, req.getDstInstanceId())
                .eq(CiInstanceRel::getIsDeleted, false);
        if (ciInstanceRelMapper.selectCount(dupCheck) > 0) {
            throw new IllegalArgumentException("该关联关系已存在");
        }

        // mapping 基数校验：仅 1:1 限制（1:n / n:n 放行，Spec §4.4）。
        validateCardinality(def, defId, srcInstanceId, req.getDstInstanceId(), tenantId);

        // metadata 按 def.kindId 关联的 attr def schema 校验。
        Map<String, Object> metadata = req.getMetadata() != null ? req.getMetadata() : new LinkedHashMap<>();
        List<CiAssociationAttrDef> attrDefs = ciAssociationAttrDefMapper.listByKind(def.getKindId(), tenantId);
        ciFieldSchemaValidator.validateAssociationAttrs(metadata, attrDefs);

        CiInstanceRel rel = new CiInstanceRel();
        rel.setTenantId(tenantId);
        rel.setSrcInstanceId(srcInstanceId);
        rel.setDstInstanceId(req.getDstInstanceId());
        rel.setDefId(defId);
        rel.setMetadata(metadata);
        ciInstanceRelMapper.insert(rel);

        writeAudit(tenantId, "create_relation", rel.getId(), "ci_instance_rel",
                operatorId, null, snapshotRelation(rel));

        return toVO(rel, src.getName(), dst.getName());
    }

    /**
     * 返回当前实例模型可作为 {@code src} 建立的关联定义（前端选择 def 而非裸 kind，AC3-8）。
     */
    public List<CiAssociationDef> listApplicableDefs(Long instanceId, String tenantId) {
        CiInstance inst = loadInstance(instanceId, tenantId);
        LambdaQueryWrapper<CiAssociationDef> q = new LambdaQueryWrapper<CiAssociationDef>()
                .eq(CiAssociationDef::getTenantId, tenantId)
                .eq(CiAssociationDef::getIsDeleted, false)
                .eq(CiAssociationDef::getSrcModelId, inst.getModelId())
                .orderByAsc(CiAssociationDef::getId);
        return ciAssociationDefMapper.selectList(q);
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

            // Validate against schema：按该 rel 所属 def 的 kindId 取 attr def。
            String kindId = resolveKindId(rel, tenantId);
            List<CiAssociationAttrDef> attrDefs = ciAssociationAttrDefMapper.listByKind(kindId, tenantId);
            ciFieldSchemaValidator.validateAssociationAttrs(merged, attrDefs);

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
        if (kind != null && !kind.isBlank()) query.eq(CiInstanceRel::getDefId, kind);
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

    /**
     * 解析目标关联定义：canonical {@code defId} 优先；缺失时按 AD-3 兼容策略由裸
     * {@code associationKind} + (srcModel, dstModel) 推导。两者皆空则报错。
     */
    private CiAssociationDef resolveDef(CreateRelationRequest req, CiInstance src, CiInstance dst, String tenantId) {
        String defId = req.getDefId();
        if (defId != null && !defId.isBlank()) {
            CiAssociationDef def = ciAssociationDefMapper.findByDefId(defId.trim(), tenantId);
            if (def == null) {
                throw new IllegalArgumentException("关联定义不存在: " + defId);
            }
            return def;
        }
        // 兼容 alias（deprecated associationKind）。
        String kind = req.getAssociationKind();
        if (kind == null || kind.isBlank()) {
            throw new IllegalArgumentException("defId 不能为空");
        }
        LambdaQueryWrapper<CiAssociationDef> q = new LambdaQueryWrapper<CiAssociationDef>()
                .eq(CiAssociationDef::getTenantId, tenantId)
                .eq(CiAssociationDef::getIsDeleted, false)
                .eq(CiAssociationDef::getKindId, kind.trim())
                .eq(CiAssociationDef::getSrcModelId, src.getModelId())
                .eq(CiAssociationDef::getDstModelId, dst.getModelId());
        List<CiAssociationDef> matches = ciAssociationDefMapper.selectList(q);
        if (matches.isEmpty()) {
            throw new IllegalArgumentException(
                    "无法根据 associationKind='" + kind + "' 及模型 " + src.getModelId()
                            + " → " + dst.getModelId() + " 推导关联定义，请改用 defId");
        }
        return matches.get(0);
    }

    private void validateCardinality(CiAssociationDef def, String defId, Long srcInstanceId, Long dstInstanceId, String tenantId) {
        if (!"1:1".equals(def.getMapping())) {
            return;
        }
        // 1:1：src 与 dst 各自在该 def 下至多参与一次。
        LambdaQueryWrapper<CiInstanceRel> c = new LambdaQueryWrapper<CiInstanceRel>()
                .eq(CiInstanceRel::getTenantId, tenantId)
                .eq(CiInstanceRel::getDefId, defId)
                .eq(CiInstanceRel::getIsDeleted, false)
                .and(w -> w.eq(CiInstanceRel::getSrcInstanceId, srcInstanceId)
                        .or().eq(CiInstanceRel::getDstInstanceId, dstInstanceId));
        if (ciInstanceRelMapper.selectCount(c) > 0) {
            throw new IllegalArgumentException("关联定义 " + defId + " 为 1:1，该实例已存在同类关联");
        }
    }

    /** rel.defId → def.kindId（用于取 attr def schema）。def 缺失时回退为 defId 本身。 */
    private String resolveKindId(CiInstanceRel rel, String tenantId) {
        CiAssociationDef def = ciAssociationDefMapper.findByDefId(rel.getDefId(), tenantId);
        return def != null ? def.getKindId() : rel.getDefId();
    }

    private CiRelationVO toVO(CiInstanceRel rel, String srcName, String dstName) {
        CiRelationVO vo = new CiRelationVO();
        vo.setId(rel.getId());
        vo.setSrcInstanceId(rel.getSrcInstanceId());
        vo.setSrcInstanceName(srcName);
        vo.setDstInstanceId(rel.getDstInstanceId());
        vo.setDstInstanceName(dstName);
        vo.setAssociationKind(rel.getDefId());
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
            // JSON key 保持 "associationKind" 以兼容历史审计快照与 CiTopologyCompareService 读取。
            map.put("associationKind", rel.getDefId());
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
