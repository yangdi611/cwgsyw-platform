package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.association.CiAssociationDefVO;
import com.cwgsyw.platform.module.cmdb.dto.association.CreateAssociationDefRequest;
import com.cwgsyw.platform.module.cmdb.dto.association.UpdateAssociationDefRequest;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationDef;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationKind;
import com.cwgsyw.platform.module.cmdb.entity.CiInstanceRel;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationDefMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationKindMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceRelMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 模型关联定义（{@code ci_association_def}）的 CRUD。
 *
 * <p>关联定义声明「两个模型之间允许建立的某种关联」——方向、语义种类（kind）、
 * 基数（mapping）与删除策略。实例关联（{@code ci_instance_rel.def_id}）以本表
 * {@code def_id} 为外键依据，因此删除一个已被实例引用的定义会被拒绝。
 */
@Service
@RequiredArgsConstructor
public class CiAssociationDefService {

    private final CiAssociationDefMapper ciAssociationDefMapper;
    private final CiAssociationKindMapper ciAssociationKindMapper;
    private final CiModelMapper ciModelMapper;
    private final CiInstanceRelMapper ciInstanceRelMapper;
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    public List<CiAssociationDefVO> list(String tenantId, String srcModelId, String dstModelId) {
        LambdaQueryWrapper<CiAssociationDef> q = new LambdaQueryWrapper<CiAssociationDef>()
                .eq(CiAssociationDef::getTenantId, tenantId)
                .eq(CiAssociationDef::getIsDeleted, false)
                .orderByAsc(CiAssociationDef::getId);
        if (srcModelId != null && !srcModelId.isBlank()) {
            q.eq(CiAssociationDef::getSrcModelId, srcModelId);
        }
        if (dstModelId != null && !dstModelId.isBlank()) {
            q.eq(CiAssociationDef::getDstModelId, dstModelId);
        }
        List<CiAssociationDef> defs = ciAssociationDefMapper.selectList(q);

        Map<String, String> kindNames = resolveKindNames(tenantId);
        Map<String, String> modelNames = resolveModelNames(tenantId);

        return defs.stream().map(d -> toVO(d, kindNames, modelNames)).collect(Collectors.toList());
    }

    /**
     * 列出与给定模型相关（作为 src 或 dst）的关联定义。供 CiModelService.toVO 填充
     * model 详情时的 associationDefs 字段使用。
     */
    public List<CiAssociationDefVO> listByModel(String modelId, String tenantId) {
        LambdaQueryWrapper<CiAssociationDef> q = new LambdaQueryWrapper<CiAssociationDef>()
                .eq(CiAssociationDef::getTenantId, tenantId)
                .eq(CiAssociationDef::getIsDeleted, false)
                .and(w -> w.eq(CiAssociationDef::getSrcModelId, modelId)
                        .or().eq(CiAssociationDef::getDstModelId, modelId))
                .orderByAsc(CiAssociationDef::getId);
        List<CiAssociationDef> defs = ciAssociationDefMapper.selectList(q);
        if (defs.isEmpty()) return List.of();

        Map<String, String> kindNames = resolveKindNames(tenantId);
        Map<String, String> modelNames = resolveModelNames(tenantId);
        return defs.stream().map(d -> toVO(d, kindNames, modelNames)).collect(Collectors.toList());
    }

    @Transactional
    public CiAssociationDefVO create(CreateAssociationDefRequest req, String tenantId, Long operatorId) {
        if (ciAssociationDefMapper.findByDefId(req.getDefId(), tenantId) != null) {
            throw new IllegalArgumentException("关联定义标识已存在: " + req.getDefId());
        }
        validateKindAndModels(tenantId, req.getKindId(), req.getSrcModelId(), req.getDstModelId());

        CiAssociationDef def = new CiAssociationDef();
        def.setTenantId(tenantId);
        def.setDefId(req.getDefId());
        def.setName(req.getName());
        def.setKindId(req.getKindId());
        def.setSrcModelId(req.getSrcModelId());
        def.setDstModelId(req.getDstModelId());
        def.setMapping(req.getMapping());
        def.setOnDelete(req.getOnDelete() != null ? req.getOnDelete() : "none");
        def.setIsBuiltIn(false);
        ciAssociationDefMapper.insert(def);

        writeAudit(tenantId, "create_association_def", def.getId(), operatorId, null, snapshot(def));
        return toVO(def, resolveKindNames(tenantId), resolveModelNames(tenantId));
    }

    @Transactional
    public CiAssociationDefVO update(Long id, UpdateAssociationDefRequest req,
                                     String tenantId, Long operatorId) {
        CiAssociationDef def = loadDef(id, tenantId);
        String before = snapshot(def);

        if (req.getName() != null) def.setName(req.getName());
        if (req.getMapping() != null) def.setMapping(req.getMapping());
        if (req.getOnDelete() != null) def.setOnDelete(req.getOnDelete());
        ciAssociationDefMapper.updateById(def);

        writeAudit(tenantId, "update_association_def", def.getId(), operatorId, before, snapshot(def));
        return toVO(def, resolveKindNames(tenantId), resolveModelNames(tenantId));
    }

    @Transactional
    public void delete(Long id, String tenantId, Long operatorId) {
        CiAssociationDef def = loadDef(id, tenantId);
        if (Boolean.TRUE.equals(def.getIsBuiltIn())) {
            throw new IllegalArgumentException("内置关联定义不可删除");
        }

        // 防止删除已被实例引用的定义（保持引用完整性）
        long usedCount = ciInstanceRelMapper.selectCount(new LambdaQueryWrapper<CiInstanceRel>()
                .eq(CiInstanceRel::getTenantId, tenantId)
                .eq(CiInstanceRel::getDefId, def.getDefId())
                .eq(CiInstanceRel::getIsDeleted, false));
        if (usedCount > 0) {
            throw new IllegalArgumentException(
                    "该关联定义已被 " + usedCount + " 条实例关联引用，无法删除");
        }

        String before = snapshot(def);
        // @TableLogic 接管 isDeleted；先 set 审计字段再走 deleteById（MP 自动改 is_deleted=true）
        def.setDeletedAt(LocalDateTime.now());
        def.setDeletedBy(operatorId);
        ciAssociationDefMapper.updateById(def);
        ciAssociationDefMapper.deleteById(def.getId());

        writeAudit(tenantId, "delete_association_def", def.getId(), operatorId, before, null);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private CiAssociationDef loadDef(Long id, String tenantId) {
        CiAssociationDef def = ciAssociationDefMapper.selectById(id);
        if (def == null || Boolean.TRUE.equals(def.getIsDeleted())
                || !tenantId.equals(def.getTenantId())) {
            throw new IllegalArgumentException("关联定义不存在");
        }
        return def;
    }

    private void validateKindAndModels(String tenantId, String kindId,
                                       String srcModelId, String dstModelId) {
        CiAssociationKind kind = ciAssociationKindMapper.selectOne(
                new LambdaQueryWrapper<CiAssociationKind>()
                        .eq(CiAssociationKind::getTenantId, tenantId)
                        .eq(CiAssociationKind::getCode, kindId)
                        .eq(CiAssociationKind::getIsDeleted, false));
        if (kind == null) throw new IllegalArgumentException("关联种类不存在: " + kindId);

        if (ciModelMapper.findByName(srcModelId, tenantId).isEmpty()) {
            throw new IllegalArgumentException("源模型不存在: " + srcModelId);
        }
        if (ciModelMapper.findByName(dstModelId, tenantId).isEmpty()) {
            throw new IllegalArgumentException("目标模型不存在: " + dstModelId);
        }
    }

    private Map<String, String> resolveKindNames(String tenantId) {
        return ciAssociationKindMapper.selectList(new LambdaQueryWrapper<CiAssociationKind>()
                .eq(CiAssociationKind::getTenantId, tenantId)
                .eq(CiAssociationKind::getIsDeleted, false))
                .stream().collect(Collectors.toMap(CiAssociationKind::getCode, CiAssociationKind::getName));
    }

    private Map<String, String> resolveModelNames(String tenantId) {
        return ciModelMapper.selectList(new LambdaQueryWrapper<CiModel>()
                .eq(CiModel::getTenantId, tenantId)
                .eq(CiModel::getIsDeleted, false))
                .stream().collect(Collectors.toMap(CiModel::getModelId, CiModel::getDisplayName));
    }

    private CiAssociationDefVO toVO(CiAssociationDef def,
                                    Map<String, String> kindNames,
                                    Map<String, String> modelNames) {
        CiAssociationDefVO vo = new CiAssociationDefVO();
        vo.setId(def.getId());
        vo.setDefId(def.getDefId());
        vo.setName(def.getName());
        vo.setKindId(def.getKindId());
        vo.setKindName(kindNames.getOrDefault(def.getKindId(), def.getKindId()));
        vo.setSrcModelId(def.getSrcModelId());
        vo.setSrcModelName(modelNames.getOrDefault(def.getSrcModelId(), def.getSrcModelId()));
        vo.setDstModelId(def.getDstModelId());
        vo.setDstModelName(modelNames.getOrDefault(def.getDstModelId(), def.getDstModelId()));
        vo.setMapping(def.getMapping());
        vo.setOnDelete(def.getOnDelete());
        vo.setIsBuiltIn(def.getIsBuiltIn());
        return vo;
    }

    private String snapshot(CiAssociationDef d) {
        try {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", d.getId());
            map.put("defId", d.getDefId());
            map.put("name", d.getName());
            map.put("kindId", d.getKindId());
            map.put("srcModelId", d.getSrcModelId());
            map.put("dstModelId", d.getDstModelId());
            map.put("mapping", d.getMapping());
            map.put("onDelete", d.getOnDelete());
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            return "{}";
        }
    }

    private void writeAudit(String tenantId, String action, Long targetId,
                            Long operatorId, String beforeJson, String afterJson) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("cmdb").action(action)
                .targetId(targetId).targetType("ci_association_def")
                .operatorId(operatorId != null ? operatorId : 0L)
                .beforeJson(beforeJson).afterJson(afterJson)
                .createdAt(LocalDateTime.now()).build());
    }
}
