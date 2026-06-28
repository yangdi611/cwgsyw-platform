package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.endpoint.CreateEndpointLinkRequest;
import com.cwgsyw.platform.module.cmdb.dto.endpoint.EndpointLinkVO;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationDef;
import com.cwgsyw.platform.module.cmdb.entity.CiEndpointLink;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationDefMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiEndpointLinkMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 端点连接服务（spec §8，P3）。ci_endpoint_link 是端口/LUN 级连接的唯一事实源；
 * 增删连接时同步维护 ci_instance_rel 的 connect 类 managed 镜像边（拓扑图复用）。
 */
@Service
@RequiredArgsConstructor
public class EndpointLinkService {

    private final CiEndpointLinkMapper ciEndpointLinkMapper;
    private final CiInstanceMapper ciInstanceMapper;
    private final CiAssociationDefMapper ciAssociationDefMapper;
    private final CiRelationService ciRelationService;
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    @Transactional
    public EndpointLinkVO create(CreateEndpointLinkRequest req, String tenantId, Long operatorId) {
        CiInstance src = loadInstance(req.getSrcInstanceId(), tenantId);
        CiInstance dst = loadInstance(req.getDstInstanceId(), tenantId);

        // 同向去重（唯一索引兜底，此处可读报错）。
        LambdaQueryWrapper<CiEndpointLink> dup = new LambdaQueryWrapper<CiEndpointLink>()
                .eq(CiEndpointLink::getTenantId, tenantId)
                .eq(CiEndpointLink::getLinkType, req.getLinkType())
                .eq(CiEndpointLink::getSrcInstanceId, req.getSrcInstanceId())
                .eq(CiEndpointLink::getSrcFieldKey, req.getSrcFieldKey())
                .eq(CiEndpointLink::getSrcEndpointUid, req.getSrcEndpointUid())
                .eq(CiEndpointLink::getIsDeleted, false);
        if (ciEndpointLinkMapper.selectCount(dup) > 0) {
            throw new IllegalArgumentException("该源端点已被占用，请先解除原有连接");
        }

        CiEndpointLink link = new CiEndpointLink();
        link.setTenantId(tenantId);
        link.setLinkType(req.getLinkType());
        link.setSrcInstanceId(req.getSrcInstanceId());
        link.setSrcFieldKey(req.getSrcFieldKey());
        link.setSrcEndpointUid(req.getSrcEndpointUid());
        link.setSrcEndpointLabel(req.getSrcEndpointLabel());
        link.setDstInstanceId(req.getDstInstanceId());
        link.setDstFieldKey(req.getDstFieldKey());
        link.setDstEndpointUid(req.getDstEndpointUid());
        link.setDstEndpointLabel(req.getDstEndpointLabel());
        link.setAttrs(req.getAttrs() != null ? req.getAttrs() : new LinkedHashMap<>());
        ciEndpointLinkMapper.insert(link);

        // 同步 managed connect 镜像边（按 src/dst 模型解析 connect def）。
        String defId = resolveConnectDefId(src.getModelId(), dst.getModelId(), tenantId);
        if (defId != null) {
            ciRelationService.ensureManagedEdge(req.getSrcInstanceId(), req.getDstInstanceId(),
                    defId, tenantId, operatorId);
        }

        writeAudit(tenantId, "create_endpoint_link", link.getId(), operatorId, null, snapshot(link));
        return toVO(link, src.getName(), dst.getName());
    }

    @Transactional
    public void delete(Long linkId, String tenantId, Long operatorId) {
        CiEndpointLink link = ciEndpointLinkMapper.selectById(linkId);
        if (link == null || Boolean.TRUE.equals(link.getIsDeleted()) || !link.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("连接不存在");
        }
        String before = snapshot(link);
        link.setDeletedAt(LocalDateTime.now());
        link.setDeletedBy(operatorId);
        ciEndpointLinkMapper.updateById(link);
        ciEndpointLinkMapper.deleteById(linkId);

        // 递减 managed 镜像边 link_count，归零软删。
        CiInstance src = ciInstanceMapper.selectById(link.getSrcInstanceId());
        CiInstance dst = ciInstanceMapper.selectById(link.getDstInstanceId());
        if (src != null && dst != null) {
            String defId = resolveConnectDefId(src.getModelId(), dst.getModelId(), tenantId);
            if (defId != null) {
                ciRelationService.releaseManagedEdge(link.getSrcInstanceId(), link.getDstInstanceId(),
                        defId, tenantId, operatorId);
            }
        }
        writeAudit(tenantId, "delete_endpoint_link", linkId, operatorId, before, null);
    }

    /** 某实例的所有连接（作为 src 或 dst）。 */
    public List<EndpointLinkVO> listByInstance(Long instanceId, String tenantId) {
        LambdaQueryWrapper<CiEndpointLink> q = new LambdaQueryWrapper<CiEndpointLink>()
                .eq(CiEndpointLink::getTenantId, tenantId)
                .eq(CiEndpointLink::getIsDeleted, false)
                .and(w -> w.eq(CiEndpointLink::getSrcInstanceId, instanceId)
                        .or().eq(CiEndpointLink::getDstInstanceId, instanceId))
                .orderByDesc(CiEndpointLink::getId);
        return ciEndpointLinkMapper.selectList(q).stream().map(l -> {
            CiInstance s = ciInstanceMapper.selectById(l.getSrcInstanceId());
            CiInstance d = ciInstanceMapper.selectById(l.getDstInstanceId());
            return toVO(l, s != null ? s.getName() : "unknown", d != null ? d.getName() : "unknown");
        }).toList();
    }

    /**
     * 解析 src→dst 模型对应的 connect 类 def_id。无匹配返回 null（不建镜像边，但连接仍记录）。
     */
    private String resolveConnectDefId(String srcModel, String dstModel, String tenantId) {
        LambdaQueryWrapper<CiAssociationDef> q = new LambdaQueryWrapper<CiAssociationDef>()
                .eq(CiAssociationDef::getTenantId, tenantId)
                .eq(CiAssociationDef::getIsDeleted, false)
                .eq(CiAssociationDef::getKindId, "connect")
                .eq(CiAssociationDef::getSrcModelId, srcModel)
                .eq(CiAssociationDef::getDstModelId, dstModel)
                .orderByAsc(CiAssociationDef::getId)
                .last("LIMIT 1");
        CiAssociationDef def = ciAssociationDefMapper.selectOne(q);
        return def != null ? def.getDefId() : null;
    }

    private CiInstance loadInstance(Long id, String tenantId) {
        CiInstance inst = ciInstanceMapper.selectById(id);
        if (inst == null || Boolean.TRUE.equals(inst.getIsDeleted()) || !inst.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("实例不存在: " + id);
        }
        return inst;
    }

    private EndpointLinkVO toVO(CiEndpointLink l, String srcName, String dstName) {
        EndpointLinkVO vo = new EndpointLinkVO();
        vo.setId(l.getId());
        vo.setLinkType(l.getLinkType());
        vo.setSrcInstanceId(l.getSrcInstanceId());
        vo.setSrcInstanceName(srcName);
        vo.setSrcFieldKey(l.getSrcFieldKey());
        vo.setSrcEndpointUid(l.getSrcEndpointUid());
        vo.setSrcEndpointLabel(l.getSrcEndpointLabel());
        vo.setDstInstanceId(l.getDstInstanceId());
        vo.setDstInstanceName(dstName);
        vo.setDstFieldKey(l.getDstFieldKey());
        vo.setDstEndpointUid(l.getDstEndpointUid());
        vo.setDstEndpointLabel(l.getDstEndpointLabel());
        vo.setAttrs(l.getAttrs());
        vo.setCreatedAt(l.getCreatedAt());
        return vo;
    }

    private String snapshot(CiEndpointLink l) {
        try { return objectMapper.writeValueAsString(l); } catch (Exception e) { return "{}"; }
    }

    private void writeAudit(String tenantId, String action, Long targetId, Long operatorId,
                            String beforeJson, String afterJson) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("cmdb").action(action)
                .targetId(targetId).targetType("ci_endpoint_link")
                .operatorId(operatorId != null ? operatorId : 0L)
                .beforeJson(beforeJson).afterJson(afterJson)
                .createdAt(LocalDateTime.now()).build());
    }
}
