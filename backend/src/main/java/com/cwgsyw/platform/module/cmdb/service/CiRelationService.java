package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.cmdb.dto.relation.CiRelationVO;
import com.cwgsyw.platform.module.cmdb.dto.relation.CreateRelationRequest;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationKind;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiInstanceRel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationKindMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceRelMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CiRelationService {

    private final CiInstanceRelMapper ciInstanceRelMapper;
    private final CiInstanceMapper ciInstanceMapper;
    private final CiAssociationKindMapper ciAssociationKindMapper;

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

        CiInstanceRel rel = new CiInstanceRel();
        rel.setTenantId(tenantId);
        rel.setSrcInstanceId(srcInstanceId);
        rel.setDstInstanceId(req.getDstInstanceId());
        rel.setAssociationKind(req.getAssociationKind());
        ciInstanceRelMapper.insert(rel);
        return toVO(rel, src.getName(), dst.getName());
    }

    @Transactional
    public void delete(Long relationId, String tenantId, Long operatorId) {
        CiInstanceRel rel = ciInstanceRelMapper.selectById(relationId);
        if (rel == null || rel.getIsDeleted() || !rel.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("关联关系不存在");
        }
        rel.setIsDeleted(true); rel.setDeletedAt(LocalDateTime.now()); rel.setDeletedBy(operatorId);
        ciInstanceRelMapper.updateById(rel);
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
        vo.setId(rel.getId()); vo.setSrcInstanceId(rel.getSrcInstanceId()); vo.setSrcInstanceName(srcName);
        vo.setDstInstanceId(rel.getDstInstanceId()); vo.setDstInstanceName(dstName);
        vo.setAssociationKind(rel.getAssociationKind()); vo.setCreatedAt(rel.getCreatedAt());
        return vo;
    }
}
