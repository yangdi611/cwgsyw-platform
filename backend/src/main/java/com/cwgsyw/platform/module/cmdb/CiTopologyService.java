package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.cmdb.dto.*;
import com.cwgsyw.platform.module.cmdb.entity.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CiTopologyService {

    private final CiInstanceRelMapper relMapper;
    private final CiInstanceMapper instanceMapper;
    private final CiModelMapper modelMapper;
    private final CiAssociationDefMapper defMapper;
    private final CiAssociationKindMapper kindMapper;

    public CiTopologyResult getTopology(String tenantId, Long rootId, int depth) {
        depth = Math.min(Math.max(depth, 1), 5);

        Map<Long, Integer> visitedNodes = new LinkedHashMap<>();
        Map<Long, CiInstanceRel> collectedRels = new LinkedHashMap<>();

        Queue<Long> queue = new LinkedList<>();
        queue.add(rootId);
        visitedNodes.put(rootId, 0);

        while (!queue.isEmpty()) {
            Long current = queue.poll();
            int currentDepth = visitedNodes.get(current);
            if (currentDepth >= depth) continue;

            List<CiInstanceRel> rels = relMapper.findByInstance(tenantId, current);
            for (CiInstanceRel rel : rels) {
                if (collectedRels.containsKey(rel.getId())) continue;
                collectedRels.put(rel.getId(), rel);
                Long peerId = current.equals(rel.getSrcId()) ? rel.getDstId() : rel.getSrcId();
                if (!visitedNodes.containsKey(peerId)) {
                    visitedNodes.put(peerId, currentDepth + 1);
                    queue.add(peerId);
                }
            }
        }

        // Batch-fetch instances
        Map<Long, CiInstance> instMap = instanceMapper.selectBatchIds(visitedNodes.keySet())
                .stream().collect(Collectors.toMap(CiInstance::getId, i -> i));

        // Batch-fetch model names
        Set<String> modelIds = instMap.values().stream()
                .map(CiInstance::getModelId).collect(Collectors.toSet());
        Map<String, String> modelNameMap = modelIds.isEmpty() ? Map.of() :
                modelMapper.selectList(new LambdaQueryWrapper<CiModel>()
                        .in(CiModel::getModelId, modelIds))
                .stream().collect(Collectors.toMap(CiModel::getModelId, CiModel::getName));

        // Batch-fetch def -> kindId
        Set<String> defIds = collectedRels.values().stream()
                .map(CiInstanceRel::getDefId).collect(Collectors.toSet());
        Map<String, String> defKindMap = defIds.isEmpty() ? Map.of() :
                defMapper.selectList(new LambdaQueryWrapper<CiAssociationDef>()
                        .in(CiAssociationDef::getDefId, defIds))
                .stream().collect(Collectors.toMap(CiAssociationDef::getDefId, CiAssociationDef::getKindId));

        // Batch-fetch kinds
        Set<String> kindIds = new HashSet<>(defKindMap.values());
        Map<String, CiAssociationKind> kindMap = kindIds.isEmpty() ? Map.of() :
                kindMapper.selectList(new LambdaQueryWrapper<CiAssociationKind>()
                        .in(CiAssociationKind::getKindId, kindIds))
                .stream().collect(Collectors.toMap(CiAssociationKind::getKindId, k -> k));

        // Build nodes
        List<TopologyNodeVO> nodes = visitedNodes.keySet().stream().map(id -> {
            CiInstance inst = instMap.get(id);
            TopologyNodeVO n = new TopologyNodeVO();
            n.setId(id);
            n.setName(inst != null && inst.getName() != null ? inst.getName() : "#" + id);
            n.setModelId(inst != null ? inst.getModelId() : null);
            n.setModelName(inst != null ? modelNameMap.getOrDefault(inst.getModelId(), inst.getModelId()) : null);
            n.setIsRoot(id.equals(rootId));
            return n;
        }).collect(Collectors.toList());

        // Build edges
        List<TopologyEdgeVO> edges = collectedRels.values().stream().map(rel -> {
            String kindId = defKindMap.get(rel.getDefId());
            CiAssociationKind kind = kindId != null ? kindMap.get(kindId) : null;
            TopologyEdgeVO e = new TopologyEdgeVO();
            e.setId(rel.getId());
            e.setSrcId(rel.getSrcId());
            e.setDstId(rel.getDstId());
            e.setLabel(kind != null ? kind.getSrcToDst() : "");
            e.setDefId(rel.getDefId());
            return e;
        }).collect(Collectors.toList());

        CiTopologyResult result = new CiTopologyResult();
        result.setNodes(nodes);
        result.setEdges(edges);
        return result;
    }
}
