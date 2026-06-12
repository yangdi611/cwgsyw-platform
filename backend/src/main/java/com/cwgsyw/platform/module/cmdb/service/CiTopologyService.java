package com.cwgsyw.platform.module.cmdb.service;

import com.cwgsyw.platform.module.cmdb.dto.topology.TopologyEdgeVO;
import com.cwgsyw.platform.module.cmdb.dto.topology.TopologyNodeVO;
import com.cwgsyw.platform.module.cmdb.dto.topology.TopologyResultVO;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationKind;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiInstanceRel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationKindMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceRelMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CiTopologyService {

    private static final int MAX_DEPTH = 10;

    private final CiInstanceRelMapper ciInstanceRelMapper;
    private final CiInstanceMapper ciInstanceMapper;
    private final CiModelMapper ciModelMapper;
    private final CiAssociationKindMapper ciAssociationKindMapper;

    public TopologyResultVO getTopology(Long rootInstanceId, int depth, String tenantId) {
        // Validate root instance exists
        CiInstance rootInst = ciInstanceMapper.selectById(rootInstanceId);
        if (rootInst == null || rootInst.getIsDeleted() || !rootInst.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("实例不存在");
        }

        int maxDepth = Math.min(Math.max(depth, 1), MAX_DEPTH);

        // Run recursive CTE
        List<CiInstanceRel> edges = ciInstanceRelMapper.findTopologyEdges(rootInstanceId, tenantId, maxDepth);

        // Collect all involved instance IDs
        Set<Long> instanceIds = new HashSet<>();
        instanceIds.add(rootInstanceId);
        for (CiInstanceRel edge : edges) {
            instanceIds.add(edge.getSrcInstanceId());
            instanceIds.add(edge.getDstInstanceId());
        }

        // Batch load instances
        Map<Long, CiInstance> instanceMap = new HashMap<>();
        if (!instanceIds.isEmpty()) {
            ciInstanceMapper.selectBatchIds(instanceIds).forEach(inst ->
                    instanceMap.put(inst.getId(), inst));
        }

        // Batch load model names
        Map<String, String> modelDisplayNames = new HashMap<>();
        for (CiInstance inst : instanceMap.values()) {
            if (!modelDisplayNames.containsKey(inst.getModelId())) {
                ciModelMapper.findByName(inst.getModelId(), tenantId)
                        .ifPresent(m -> modelDisplayNames.put(m.getName(), m.getDisplayName()));
            }
        }

        // Batch load association kind labels
        Map<String, String> kindLabels = loadKindLabels(tenantId);

        // Build nodes
        List<TopologyNodeVO> nodes = instanceIds.stream().map(id -> {
            CiInstance inst = instanceMap.get(id);
            TopologyNodeVO node = new TopologyNodeVO();
            node.setId(id);
            if (inst != null) {
                node.setName(inst.getName());
                node.setModelId(inst.getModelId());
                node.setModelName(modelDisplayNames.getOrDefault(inst.getModelId(), inst.getModelId()));
            }
            node.setRoot(id.equals(rootInstanceId));
            return node;
        }).collect(Collectors.toList());

        // Build edges (deduplicate)
        Set<String> seenEdges = new HashSet<>();
        List<TopologyEdgeVO> edgeVOs = new ArrayList<>();
        for (CiInstanceRel rel : edges) {
            String edgeKey = rel.getSrcInstanceId() + "-" + rel.getDstInstanceId() + "-" + rel.getAssociationKind();
            if (seenEdges.add(edgeKey)) {
                TopologyEdgeVO edge = new TopologyEdgeVO();
                edge.setSrc(rel.getSrcInstanceId());
                edge.setDst(rel.getDstInstanceId());
                edge.setKind(rel.getAssociationKind());
                edge.setLabel(kindLabels.getOrDefault(rel.getAssociationKind(), rel.getAssociationKind()));
                edgeVOs.add(edge);
            }
        }

        TopologyResultVO result = new TopologyResultVO();
        result.setNodes(nodes);
        result.setEdges(edgeVOs);
        return result;
    }

    private Map<String, String> loadKindLabels(String tenantId) {
        LambdaQueryWrapper<CiAssociationKind> q = new LambdaQueryWrapper<CiAssociationKind>()
                .eq(CiAssociationKind::getTenantId, tenantId)
                .eq(CiAssociationKind::getIsDeleted, false);
        return ciAssociationKindMapper.selectList(q).stream()
                .collect(Collectors.toMap(CiAssociationKind::getCode, CiAssociationKind::getName, (a, b) -> a));
    }
}
