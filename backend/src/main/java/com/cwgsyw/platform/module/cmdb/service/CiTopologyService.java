package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.cmdb.dto.topology.TopologyEdgeVO;
import com.cwgsyw.platform.module.cmdb.dto.topology.TopologyNodeVO;
import com.cwgsyw.platform.module.cmdb.dto.topology.TopologyResultVO;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationKind;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiInstanceRel;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationKindMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceRelMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
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
    private final CiAttributeMapper ciAttributeMapper;

    public TopologyResultVO getTopology(Long rootInstanceId, int depth, String tenantId) {
        CiInstance rootInst = ciInstanceMapper.selectById(rootInstanceId);
        if (rootInst == null || rootInst.getIsDeleted() || !rootInst.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("实例不存在");
        }

        int maxDepth = Math.min(Math.max(depth, 1), MAX_DEPTH);
        List<CiInstanceRel> edges = ciInstanceRelMapper.findTopologyEdges(rootInstanceId, tenantId, maxDepth);

        Set<Long> instanceIds = new HashSet<>();
        instanceIds.add(rootInstanceId);
        for (CiInstanceRel edge : edges) {
            instanceIds.add(edge.getSrcInstanceId());
            instanceIds.add(edge.getDstInstanceId());
        }

        Map<Long, CiInstance> instanceMap = new HashMap<>();
        if (!instanceIds.isEmpty()) {
            ciInstanceMapper.selectBatchIds(instanceIds).forEach(inst -> instanceMap.put(inst.getId(), inst));
        }

        Map<String, String> modelDisplayNames = new HashMap<>();
        Map<String, String> modelColors = new HashMap<>();
        Map<String, Set<String>> modelListShowKeys = new HashMap<>();
        for (CiInstance inst : instanceMap.values()) {
            if (!modelDisplayNames.containsKey(inst.getModelId())) {
                ciModelMapper.findByName(inst.getModelId(), tenantId)
                        .ifPresent(m -> {
                            modelDisplayNames.put(m.getName(), m.getDisplayName());
                            modelColors.put(m.getName(), m.getColor());
                            // Collect is_list_show=true attribute keys for this model
                            List<CiAttribute> attrs = ciAttributeMapper.listByModel(m.getName(), tenantId);
                            Set<String> listShowKeys = attrs.stream()
                                    .filter(a -> Boolean.TRUE.equals(a.getIsListShow()))
                                    .map(CiAttribute::getFieldKey)
                                    .collect(Collectors.toSet());
                            modelListShowKeys.put(m.getName(), listShowKeys);
                        });
            }
        }

        Map<String, String> kindLabels = loadKindLabels(tenantId);

        List<TopologyNodeVO> nodes = instanceIds.stream().map(id -> {
            CiInstance inst = instanceMap.get(id);
            TopologyNodeVO node = new TopologyNodeVO();
            node.setId(id);
            if (inst != null) {
                node.setName(inst.getName()); node.setModelId(inst.getModelId());
                node.setModelName(modelDisplayNames.getOrDefault(inst.getModelId(), inst.getModelId()));
                node.setModelColor(modelColors.get(inst.getModelId()));
                node.setStatus(inst.getStatus());
                node.setOwner(inst.getOwner());
                // Extract keyAttrs from fieldsData for list_show attributes
                Set<String> listShowKeys = modelListShowKeys.get(inst.getModelId());
                if (listShowKeys != null && !listShowKeys.isEmpty() && inst.getFieldsData() != null) {
                    Map<String, Object> keyAttrs = new LinkedHashMap<>();
                    for (String key : listShowKeys) {
                        if (inst.getFieldsData().containsKey(key)) {
                            keyAttrs.put(key, inst.getFieldsData().get(key));
                        }
                    }
                    node.setKeyAttrs(keyAttrs);
                }
            }
            node.setRoot(id.equals(rootInstanceId));
            return node;
        }).collect(Collectors.toList());

        Set<String> seenEdges = new HashSet<>();
        List<TopologyEdgeVO> edgeVOs = new ArrayList<>();
        for (CiInstanceRel rel : edges) {
            String edgeKey = rel.getSrcInstanceId() + "-" + rel.getDstInstanceId() + "-" + rel.getAssociationKind();
            if (seenEdges.add(edgeKey)) {
                TopologyEdgeVO edge = new TopologyEdgeVO();
                edge.setSrc(rel.getSrcInstanceId()); edge.setDst(rel.getDstInstanceId());
                edge.setKind(rel.getAssociationKind());
                edge.setLabel(kindLabels.getOrDefault(rel.getAssociationKind(), rel.getAssociationKind()));
                edgeVOs.add(edge);
            }
        }

        TopologyResultVO result = new TopologyResultVO();
        result.setNodes(nodes); result.setEdges(edgeVOs);
        return result;
    }

    private Map<String, String> loadKindLabels(String tenantId) {
        LambdaQueryWrapper<CiAssociationKind> q = new LambdaQueryWrapper<CiAssociationKind>()
                .eq(CiAssociationKind::getTenantId, tenantId).eq(CiAssociationKind::getIsDeleted, false);
        return ciAssociationKindMapper.selectList(q).stream()
                .collect(Collectors.toMap(CiAssociationKind::getCode, CiAssociationKind::getName, (a, b) -> a));
    }
}
