package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.cmdb.dto.impact.*;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationKind;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiInstanceRel;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationKindMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceRelMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImpactAnalysisService {

    private static final long TIMEOUT_MS = 5000;
    private static final int CTE_MAX_DEPTH = 3;
    private static final int CTE_MAX_NODES = 200;

    private final CiInstanceMapper ciInstanceMapper;
    private final CiInstanceRelMapper ciInstanceRelMapper;
    private final CiModelMapper ciModelMapper;
    private final CiAssociationKindMapper ciAssociationKindMapper;
    private final JdbcTemplate jdbcTemplate;

    public ImpactAnalysisResultVO analyze(Long rootInstanceId, ImpactAnalysisRequest req, String tenantId) {
        // Validate root instance
        CiInstance root = ciInstanceMapper.selectById(rootInstanceId);
        if (root == null || root.getIsDeleted() || !root.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("实例不存在");
        }

        String direction = req.getDirection() != null ? req.getDirection() : "bidirectional";
        int maxDepth = Math.min(Math.max(req.getMaxDepth() != null ? req.getMaxDepth() : 3, 1), 5);

        // Choose strategy: CTE for small graphs, Java BFS for large ones
        int estimatedNodes = estimateNodeCount(rootInstanceId, maxDepth, tenantId);
        boolean useCte = maxDepth <= CTE_MAX_DEPTH && estimatedNodes < CTE_MAX_NODES;

        long startTime = System.nanoTime();
        ImpactAnalysisResultVO result;
        if (useCte) {
            result = analyzeWithCte(rootInstanceId, direction, maxDepth, tenantId, startTime);
        } else {
            result = analyzeWithJavaBfs(rootInstanceId, direction, maxDepth, tenantId, startTime);
        }

        // Populate root info
        result.setRootId(root.getId());
        result.setRootName(root.getName());
        result.setRootModelId(root.getModelId());
        result.setDirection(direction);
        result.setMaxDepth(maxDepth);

        // Apply permission filtering + enrich node info
        enrichAndFilterNodes(result, tenantId);

        return result;
    }

    // ─── CTE Strategy ──────────────────────────────────────────────────────────

    private ImpactAnalysisResultVO analyzeWithCte(Long rootId, String direction, int maxDepth,
                                                    String tenantId, long startTime) {
        String sql = buildCteSql(direction);

        List<Map<String, Object>> edgeRows;
        try {
            edgeRows = jdbcTemplate.queryForList(sql, rootId, tenantId, maxDepth, TIMEOUT_MS);
        } catch (Exception e) {
            log.warn("CTE impact analysis timed out or failed, falling back to partial result", e);
            ImpactAnalysisResultVO partial = new ImpactAnalysisResultVO();
            partial.setTruncated(true);
            // Add root layer only
            List<ImpactLayerVO> layers = new ArrayList<>();
            layers.add(buildLayer(0, List.of(rootId)));
            partial.setLayers(layers);
            partial.setEdges(Collections.emptyList());
            return partial;
        }

        boolean truncated = (System.nanoTime() - startTime) > TimeUnit.MILLISECONDS.toNanos(TIMEOUT_MS);
        return buildResult(rootId, edgeRows, truncated);
    }

    private String buildCteSql(String direction) {
        String joinCondition = switch (direction) {
            case "downstream" -> "r.src_id = i.dst_id";
            case "upstream" -> "r.dst_id = i.src_id";
            default -> "(r.src_id = i.dst_id OR r.dst_id = i.src_id)";
        };

        return """
            WITH RECURSIVE impact AS (
                SELECT id, src_id, dst_id, def_id, 0 AS depth
                FROM ci_instance_rel
                WHERE (src_id = ? OR dst_id = ?)
                  AND NOT is_deleted AND tenant_id = ?
                UNION ALL
                SELECT r.id, r.src_id, r.dst_id, r.def_id, i.depth + 1
                FROM ci_instance_rel r
                INNER JOIN impact i ON %s
                WHERE i.depth < ? AND NOT r.is_deleted AND r.tenant_id = ?
            )
            SELECT DISTINCT src_id AS src, dst_id AS dst, def_id AS kind, depth
            FROM impact
            """.formatted(joinCondition);
    }

    // ─── Java BFS Strategy ────────────────────────────────────────────────────

    private ImpactAnalysisResultVO analyzeWithJavaBfs(Long rootId, String direction, int maxDepth,
                                                       String tenantId, long startTime) {
        // Queue holds (nodeId, depth)
        LinkedList<long[]> queue = new LinkedList<>();
        queue.add(new long[]{rootId, 0});
        Set<Long> visited = new HashSet<>();
        visited.add(rootId);

        // depth -> nodeIds
        Map<Integer, Set<Long>> depthMap = new TreeMap<>();
        depthMap.computeIfAbsent(0, k -> new LinkedHashSet<>()).add(rootId);

        // Edges collected
        Set<String> seenEdges = new HashSet<>();
        List<ImpactEdgeVO> edges = new ArrayList<>();
        boolean truncated = false;

        while (!queue.isEmpty()) {
            if (System.nanoTime() - startTime > TimeUnit.MILLISECONDS.toNanos(TIMEOUT_MS)) {
                truncated = true;
                break;
            }

            long[] current = queue.poll();
            long nodeId = current[0];
            int depth = (int) current[1];
            if (depth >= maxDepth) continue;

            List<CiInstanceRel> rels = queryNeighbors(nodeId, direction, tenantId);
            for (CiInstanceRel rel : rels) {
                Long neighborId = getNeighborId(rel, nodeId);
                if (neighborId == null || visited.contains(neighborId)) continue;

                visited.add(neighborId);
                depthMap.computeIfAbsent(depth + 1, k -> new LinkedHashSet<>()).add(neighborId);
                queue.add(new long[]{neighborId, depth + 1});

                // Deduplicate edges
                String edgeKey = rel.getSrcInstanceId() + "-" + rel.getDstInstanceId() + "-" + rel.getAssociationKind();
                if (seenEdges.add(edgeKey)) {
                    ImpactEdgeVO edge = new ImpactEdgeVO();
                    edge.setSrc(rel.getSrcInstanceId());
                    edge.setDst(rel.getDstInstanceId());
                    edge.setKind(rel.getAssociationKind());
                    edges.add(edge);
                }
            }
        }

        // Build layers from depthMap
        List<ImpactLayerVO> layers = new ArrayList<>();
        for (Map.Entry<Integer, Set<Long>> entry : depthMap.entrySet()) {
            layers.add(buildLayer(entry.getKey(), new ArrayList<>(entry.getValue())));
        }

        ImpactAnalysisResultVO result = new ImpactAnalysisResultVO();
        result.setTruncated(truncated);
        result.setLayers(layers);
        result.setEdges(edges);
        return result;
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private int estimateNodeCount(Long rootId, int maxDepth, String tenantId) {
        // Quick count: count direct neighbors and multiply by estimated branching factor
        LambdaQueryWrapper<CiInstanceRel> q = new LambdaQueryWrapper<CiInstanceRel>()
                .eq(CiInstanceRel::getTenantId, tenantId)
                .eq(CiInstanceRel::getIsDeleted, false)
                .and(w -> w.eq(CiInstanceRel::getSrcInstanceId, rootId)
                        .or().eq(CiInstanceRel::getDstInstanceId, rootId));
        long directCount = ciInstanceRelMapper.selectCount(q);
        // Rough estimate: assume constant branching factor
        long estimated = 1;
        for (int d = 0; d < maxDepth; d++) {
            estimated += (long) Math.pow(directCount, d + 1);
        }
        return (int) Math.min(estimated, Integer.MAX_VALUE);
    }

    private List<CiInstanceRel> queryNeighbors(Long nodeId, String direction, String tenantId) {
        LambdaQueryWrapper<CiInstanceRel> q = new LambdaQueryWrapper<CiInstanceRel>()
                .eq(CiInstanceRel::getTenantId, tenantId)
                .eq(CiInstanceRel::getIsDeleted, false);

        switch (direction) {
            case "downstream" -> q.eq(CiInstanceRel::getSrcInstanceId, nodeId);
            case "upstream" -> q.eq(CiInstanceRel::getDstInstanceId, nodeId);
            default -> q.and(w -> w.eq(CiInstanceRel::getSrcInstanceId, nodeId)
                    .or().eq(CiInstanceRel::getDstInstanceId, nodeId));
        }
        return ciInstanceRelMapper.selectList(q);
    }

    private Long getNeighborId(CiInstanceRel rel, Long currentNodeId) {
        if (rel.getSrcInstanceId().equals(currentNodeId)) return rel.getDstInstanceId();
        if (rel.getDstInstanceId().equals(currentNodeId)) return rel.getSrcInstanceId();
        return null;
    }

    private ImpactAnalysisResultVO buildResult(Long rootId, List<Map<String, Object>> edgeRows, boolean truncated) {
        // Collect node IDs and edges from CTE result
        Map<Integer, Set<Long>> depthMap = new TreeMap<>();
        depthMap.computeIfAbsent(0, k -> new LinkedHashSet<>()).add(rootId);

        Set<String> seenEdges = new HashSet<>();
        List<ImpactEdgeVO> edges = new ArrayList<>();
        Set<Long> allNodeIds = new HashSet<>();
        allNodeIds.add(rootId);

        for (Map<String, Object> row : edgeRows) {
            Long src = ((Number) row.get("src")).longValue();
            Long dst = ((Number) row.get("dst")).longValue();
            String kind = (String) row.get("kind");
            int depth = ((Number) row.get("depth")).intValue();

            allNodeIds.add(src);
            allNodeIds.add(dst);
            depthMap.computeIfAbsent(depth, k -> new LinkedHashSet<>()).add(src);
            depthMap.computeIfAbsent(depth, k -> new LinkedHashSet<>()).add(dst);

            String edgeKey = src + "-" + dst + "-" + kind;
            if (seenEdges.add(edgeKey)) {
                ImpactEdgeVO edge = new ImpactEdgeVO();
                edge.setSrc(src);
                edge.setDst(dst);
                edge.setKind(kind);
                edges.add(edge);
            }
        }

        // Build layers
        List<ImpactLayerVO> layers = new ArrayList<>();
        for (Map.Entry<Integer, Set<Long>> entry : depthMap.entrySet()) {
            layers.add(buildLayer(entry.getKey(), new ArrayList<>(entry.getValue())));
        }

        ImpactAnalysisResultVO result = new ImpactAnalysisResultVO();
        result.setTruncated(truncated);
        result.setLayers(layers);
        result.setEdges(edges);
        return result;
    }

    private ImpactLayerVO buildLayer(int depth, List<Long> nodeIds) {
        ImpactLayerVO layer = new ImpactLayerVO();
        layer.setDepth(depth);
        layer.setNodes(nodeIds.stream().map(id -> {
            ImpactNodeVO node = new ImpactNodeVO();
            node.setId(id);
            return node;
        }).collect(Collectors.toList()));
        return layer;
    }

    /**
     * Enrich nodes with instance data and apply permission filtering.
     * In MVP single-team mode, all nodes are visible. The infrastructure
     * for per-node permission filtering is in place for future multi-tenant.
     */
    private void enrichAndFilterNodes(ImpactAnalysisResultVO result, String tenantId) {
        // Collect all node IDs
        Set<Long> allNodeIds = new HashSet<>();
        for (ImpactLayerVO layer : result.getLayers()) {
            for (ImpactNodeVO node : layer.getNodes()) {
                if (node.getId() != null) allNodeIds.add(node.getId());
            }
        }

        // Batch load instances
        Map<Long, CiInstance> instanceMap = new HashMap<>();
        if (!allNodeIds.isEmpty()) {
            ciInstanceMapper.selectBatchIds(allNodeIds).forEach(inst -> instanceMap.put(inst.getId(), inst));
        }

        // Load model display names
        Map<String, String> modelDisplayNames = new HashMap<>();
        for (CiInstance inst : instanceMap.values()) {
            if (!modelDisplayNames.containsKey(inst.getModelId())) {
                ciModelMapper.findByName(inst.getModelId(), tenantId)
                        .ifPresent(m -> modelDisplayNames.put(m.getName(), m.getDisplayName()));
            }
        }

        // Load kind labels for edges
        Map<String, String> kindLabels = loadKindLabels(tenantId);

        // Enrich nodes
        for (ImpactLayerVO layer : result.getLayers()) {
            for (ImpactNodeVO node : layer.getNodes()) {
                CiInstance inst = instanceMap.get(node.getId());
                if (inst == null || inst.getIsDeleted() || !inst.getTenantId().equals(tenantId)) {
                    // Hidden node (permission filter placeholder for future multi-tenant)
                    node.setId(null);
                    node.setName("[已隐藏]");
                    node.setModelId("hidden");
                    node.setModelName("hidden");
                    continue;
                }
                node.setName(inst.getName());
                node.setModelId(inst.getModelId());
                node.setModelName(modelDisplayNames.getOrDefault(inst.getModelId(), inst.getModelId()));
                node.setStatus(inst.getStatus());
                // Extract businessLevel from fieldsData if present
                if (inst.getFieldsData() != null && inst.getFieldsData().get("business_level") != null) {
                    node.setBusinessLevel(inst.getFieldsData().get("business_level").toString());
                }
            }
        }

        // Enrich edge labels
        for (ImpactEdgeVO edge : result.getEdges()) {
            edge.setLabel(kindLabels.getOrDefault(edge.getKind(), edge.getKind()));
        }
    }

    private Map<String, String> loadKindLabels(String tenantId) {
        LambdaQueryWrapper<CiAssociationKind> q = new LambdaQueryWrapper<CiAssociationKind>()
                .eq(CiAssociationKind::getTenantId, tenantId)
                .eq(CiAssociationKind::getIsDeleted, false);
        return ciAssociationKindMapper.selectList(q).stream()
                .collect(Collectors.toMap(CiAssociationKind::getCode, CiAssociationKind::getName, (a, b) -> a));
    }
}
