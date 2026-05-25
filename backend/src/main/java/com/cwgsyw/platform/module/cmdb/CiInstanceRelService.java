package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.*;
import com.cwgsyw.platform.module.cmdb.entity.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CiInstanceRelService {

    private final CiInstanceRelMapper relMapper;
    private final CiAssociationDefMapper defMapper;
    private final CiAssociationKindMapper kindMapper;
    private final CiInstanceMapper instanceMapper;
    private final CiModelMapper modelMapper;
    private final AuditLogMapper auditLogMapper;

    public List<CiRelGroupVO> getRelations(String tenantId, Long instanceId) {
        List<CiInstanceRel> rels = relMapper.findByInstance(tenantId, instanceId);
        if (rels.isEmpty()) return List.of();

        Set<Long> peerIds = rels.stream()
            .map(r -> instanceId.equals(r.getSrcId()) ? r.getDstId() : r.getSrcId())
            .collect(Collectors.toSet());
        Map<Long, CiInstance> peerMap = instanceMapper.selectBatchIds(peerIds).stream()
            .collect(Collectors.toMap(CiInstance::getId, i -> i));

        Set<String> defIds = rels.stream().map(CiInstanceRel::getDefId).collect(Collectors.toSet());
        Map<String, CiAssociationDef> defMap = defMapper.selectList(
            new LambdaQueryWrapper<CiAssociationDef>().in(CiAssociationDef::getDefId, defIds))
            .stream().collect(Collectors.toMap(CiAssociationDef::getDefId, d -> d));

        Set<String> kindIds = defMap.values().stream()
            .map(CiAssociationDef::getKindId).collect(Collectors.toSet());
        Map<String, CiAssociationKind> kindMap = kindMapper.selectList(
            new LambdaQueryWrapper<CiAssociationKind>().in(CiAssociationKind::getKindId, kindIds))
            .stream().collect(Collectors.toMap(CiAssociationKind::getKindId, k -> k));

        Set<String> modelIds = peerMap.values().stream()
            .map(CiInstance::getModelId).collect(Collectors.toSet());
        Map<String, String> modelNameMap = modelMapper.selectList(
            new LambdaQueryWrapper<CiModel>().in(CiModel::getModelId, modelIds))
            .stream().collect(Collectors.toMap(CiModel::getModelId, CiModel::getName));

        Map<String, CiRelGroupVO> groups = new LinkedHashMap<>();
        for (CiInstanceRel rel : rels) {
            CiAssociationDef def = defMap.get(rel.getDefId());
            if (def == null) continue;
            CiAssociationKind kind = kindMap.get(def.getKindId());
            if (kind == null) continue;

            boolean isSrc = instanceId.equals(rel.getSrcId());
            Long peerId = isSrc ? rel.getDstId() : rel.getSrcId();
            CiInstance peer = peerMap.get(peerId);

            CiInstanceRelVO vo = new CiInstanceRelVO();
            vo.setId(rel.getId());
            vo.setDefId(rel.getDefId());
            vo.setIsSrc(isSrc);
            vo.setPeerId(peerId);
            vo.setPeerName(peer != null ? peer.getName() : String.valueOf(peerId));
            vo.setPeerModelId(peer != null ? peer.getModelId() : null);
            vo.setPeerModelName(peer != null
                ? modelNameMap.getOrDefault(peer.getModelId(), peer.getModelId())
                : null);
            vo.setDirectionLabel(isSrc ? kind.getSrcToDst() : kind.getDstToSrc());
            vo.setAttrs(rel.getAttrs());
            vo.setCreatedAt(rel.getCreatedAt());

            groups.computeIfAbsent(kind.getKindId(), k -> {
                CiRelGroupVO g = new CiRelGroupVO();
                g.setKindId(kind.getKindId());
                g.setKindName(kind.getName());
                g.setSrcToDst(kind.getSrcToDst());
                g.setDstToSrc(kind.getDstToSrc());
                g.setRelations(new ArrayList<>());
                return g;
            }).getRelations().add(vo);
        }

        return new ArrayList<>(groups.values());
    }

    @Transactional
    public CiInstanceRelVO createRelation(String tenantId, Long operatorId, CreateRelRequest req) {
        CiAssociationDef def = defMapper.selectOne(new LambdaQueryWrapper<CiAssociationDef>()
            .eq(CiAssociationDef::getDefId, req.getDefId()));
        if (def == null) throw new IllegalArgumentException("关联定义不存在: " + req.getDefId());

        validateMapping(tenantId, def, req.getSrcId(), req.getDstId());

        CiInstanceRel rel = new CiInstanceRel();
        rel.setTenantId(tenantId);
        rel.setDefId(req.getDefId());
        rel.setSrcId(req.getSrcId());
        rel.setDstId(req.getDstId());
        rel.setAttrs(req.getAttrs() != null ? req.getAttrs() : new HashMap<>());
        rel.setCreatedAt(LocalDateTime.now());
        rel.setUpdatedAt(LocalDateTime.now());
        rel.setCreatedBy(operatorId);
        rel.setUpdatedBy(operatorId);
        relMapper.insert(rel);

        writeAudit(tenantId, "create_rel", rel.getId(), operatorId,
            "def_id=" + req.getDefId() + " src=" + req.getSrcId() + " dst=" + req.getDstId());

        CiInstance dstInst = instanceMapper.selectById(req.getDstId());
        CiAssociationKind kind = kindMapper.selectOne(new LambdaQueryWrapper<CiAssociationKind>()
            .eq(CiAssociationKind::getKindId, def.getKindId()));

        CiInstanceRelVO vo = new CiInstanceRelVO();
        vo.setId(rel.getId());
        vo.setDefId(rel.getDefId());
        vo.setIsSrc(true);
        vo.setPeerId(req.getDstId());
        vo.setPeerName(dstInst != null ? dstInst.getName() : String.valueOf(req.getDstId()));
        vo.setPeerModelId(dstInst != null ? dstInst.getModelId() : null);
        vo.setDirectionLabel(kind != null ? kind.getSrcToDst() : def.getKindId());
        vo.setAttrs(rel.getAttrs());
        vo.setCreatedAt(rel.getCreatedAt());
        return vo;
    }

    @Transactional
    public void deleteRelation(String tenantId, Long relId, Long operatorId) {
        CiInstanceRel rel = relMapper.selectOne(new LambdaQueryWrapper<CiInstanceRel>()
            .eq(CiInstanceRel::getTenantId, tenantId)
            .eq(CiInstanceRel::getId, relId));
        if (rel == null) throw new IllegalArgumentException("关联不存在: " + relId);

        relMapper.update(null, new LambdaUpdateWrapper<CiInstanceRel>()
            .eq(CiInstanceRel::getId, relId)
            .set(CiInstanceRel::getIsDeleted, true)
            .set(CiInstanceRel::getDeletedAt, LocalDateTime.now())
            .set(CiInstanceRel::getDeletedBy, operatorId));

        writeAudit(tenantId, "delete_rel", relId, operatorId,
            "def_id=" + rel.getDefId() + " src=" + rel.getSrcId() + " dst=" + rel.getDstId());
    }

    public PageResult<InstanceSearchVO> searchInstances(String tenantId, String modelId,
                                                         String keyword, int page, int size) {
        boolean hasKeyword = StringUtils.hasText(keyword);
        LambdaQueryWrapper<CiInstance> qw = new LambdaQueryWrapper<CiInstance>()
            .eq(CiInstance::getTenantId, tenantId)
            .eq(CiInstance::getModelId, modelId)
            .like(hasKeyword, CiInstance::getName, keyword)
            .orderByDesc(CiInstance::getCreatedAt);
        long total = instanceMapper.selectCount(new LambdaQueryWrapper<CiInstance>()
            .eq(CiInstance::getTenantId, tenantId)
            .eq(CiInstance::getModelId, modelId)
            .like(hasKeyword, CiInstance::getName, keyword));
        Page<CiInstance> result = instanceMapper.selectPage(new Page<>(page, size, false), qw);
        result.setTotal(total);

        CiModel model = modelMapper.selectOne(new LambdaQueryWrapper<CiModel>()
            .eq(CiModel::getModelId, modelId));
        String modelName = model != null ? model.getName() : modelId;

        return PageResult.of(result.convert(inst -> {
            InstanceSearchVO vo = new InstanceSearchVO();
            vo.setId(inst.getId());
            vo.setName(inst.getName() != null ? inst.getName() : "#" + inst.getId());
            vo.setModelId(inst.getModelId());
            vo.setModelName(modelName);
            return vo;
        }));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void validateMapping(String tenantId, CiAssociationDef def, Long srcId, Long dstId) {
        String mapping = def.getMapping();
        if ("n:n".equals(mapping)) return;

        int dstCount = relMapper.countByDstAndDef(tenantId, def.getDefId(), dstId, -1L);
        if (dstCount > 0) {
            CiInstance dstInst = instanceMapper.selectById(dstId);
            CiModel dstModel = modelMapper.selectOne(new LambdaQueryWrapper<CiModel>()
                .eq(CiModel::getModelId, dstInst.getModelId()));
            throw new IllegalArgumentException(
                ciLabel(dstInst, dstModel) + "在此关联定义下已被占用，无法建立 " + mapping + " 关联");
        }

        if ("1:1".equals(mapping)) {
            int srcCount = relMapper.countBySrcAndDef(tenantId, def.getDefId(), srcId, -1L);
            if (srcCount > 0) {
                CiInstance srcInst = instanceMapper.selectById(srcId);
                CiModel srcModel = modelMapper.selectOne(new LambdaQueryWrapper<CiModel>()
                    .eq(CiModel::getModelId, srcInst.getModelId()));
                throw new IllegalArgumentException(
                    ciLabel(srcInst, srcModel) + "在此关联定义下已被占用，无法建立 1:1 关联");
            }
        }
    }

    private String ciLabel(CiInstance inst, CiModel model) {
        String name = inst.getName() != null ? inst.getName() : "#" + inst.getId();
        String modelName = model != null ? model.getName() : inst.getModelId();
        return name + "（" + modelName + "）";
    }

    private void writeAudit(String tenantId, String action, Long targetId,
                             Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId).module("cmdb").action(action)
            .targetId(targetId).targetType("ci_instance_rel")
            .operatorId(operatorId).remark(remark)
            .createdAt(LocalDateTime.now()).build());
    }
}
