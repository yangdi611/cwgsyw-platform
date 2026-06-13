package com.cwgsyw.platform.module.cmdb.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.topology.*;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationKind;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiInstanceRel;
import com.cwgsyw.platform.module.cmdb.mapper.*;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CiTopologyCompareService {

    private final CiTopologyService ciTopologyService;
    private final AuditLogMapper auditLogMapper;
    private final CiInstanceMapper ciInstanceMapper;
    private final CiModelMapper ciModelMapper;
    private final CiAttributeMapper ciAttributeMapper;
    private final CiAssociationKindMapper ciAssociationKindMapper;
    private final CiInstanceRelMapper ciInstanceRelMapper;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter DT_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    // ─── Internal snapshot representation ────────────────────────────────────

    @Data
    private static class TopologySnapshot {
        private final Map<Long, TopologyNodeV2VO> nodes = new LinkedHashMap<>();
        private final List<TopologyEdgeVO> edges = new ArrayList<>();
    }

    @Data
    private static class EdgeKey {
        private final Long src;
        private final Long dst;
        private final String kind;

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof EdgeKey other)) return false;
            return Objects.equals(src, other.src) && Objects.equals(dst, other.dst) && Objects.equals(kind, other.kind);
        }

        @Override
        public int hashCode() {
            return Objects.hash(src, dst, kind);
        }
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    public TopologyCompareVO compare(Long rootInstanceId, String fromTime, String toTime,
                                     int depth, String tenantId) {
        TopologySnapshot snapshotA = reconstructTopology(rootInstanceId, fromTime, depth, tenantId);
        TopologySnapshot snapshotB = reconstructTopology(rootInstanceId, toTime, depth, tenantId);
        return compareSnapshots(snapshotA, snapshotB);
    }

    // ─── Snapshot Reconstruction ────────────────────────────────────────────

    private TopologySnapshot reconstructTopology(Long rootId, String targetTime, int depth, String tenantId) {
        // 1. Get current topology
        TopologyResultVO current = ciTopologyService.getTopology(rootId, depth, tenantId);

        TopologySnapshot snapshot = new TopologySnapshot();

        // Build node map with full fieldsData
        Set<Long> nodeIds = current.getNodes().stream().map(TopologyNodeVO::getId).collect(Collectors.toSet());
        Map<Long, CiInstance> instanceMap = new HashMap<>();
        if (!nodeIds.isEmpty()) {
            ciInstanceMapper.selectBatchIds(nodeIds).forEach(inst -> instanceMap.put(inst.getId(), inst));
        }

        for (TopologyNodeVO node : current.getNodes()) {
            TopologyNodeV2VO v2 = toV2Node(node);
            CiInstance inst = instanceMap.get(node.getId());
            if (inst != null && inst.getFieldsData() != null) {
                v2.setFieldsData(inst.getFieldsData());
            }
            snapshot.getNodes().put(node.getId(), v2);
        }

        // Build edge list
        snapshot.getEdges().addAll(current.getEdges());

        // 2. Query audit_log for changes after targetTime
        List<AuditLog> changes = auditLogMapper.queryChangesList(
                tenantId,
                List.of("ci_instance", "ci_instance_rel"),
                targetTime);

        // 3. Reverse-apply changes (already sorted DESC by createdAt)
        for (AuditLog change : changes) {
            reverseApplyChange(snapshot, change);
        }

        return snapshot;
    }

    private void reverseApplyChange(TopologySnapshot snapshot, AuditLog change) {
        String targetType = change.getTargetType();
        String action = change.getAction();

        if ("ci_instance".equals(targetType)) {
            reverseApplyInstanceChange(snapshot, change, action);
        } else if ("ci_instance_rel".equals(targetType)) {
            reverseApplyRelationChange(snapshot, change, action);
        }
    }

    private void reverseApplyInstanceChange(TopologySnapshot snapshot, AuditLog change, String action) {
        Long targetId = change.getTargetId();

        switch (action) {
            case "create_instance" -> {
                // Instance was created after targetTime → remove it
                snapshot.getNodes().remove(targetId);
            }
            case "delete_instance" -> {
                // Instance was deleted after targetTime → restore from beforeJson
                Map<String, Object> before = parseJson(change.getBeforeJson());
                if (before != null) {
                    TopologyNodeV2VO node = restoreNodeFromJson(before);
                    if (node != null) {
                        snapshot.getNodes().put(targetId, node);
                    }
                }
            }
            case "update_instance" -> {
                // Update doesn't change topology structure, but fieldsData may differ
                TopologyNodeV2VO existing = snapshot.getNodes().get(targetId);
                if (existing != null) {
                    Map<String, Object> before = parseJson(change.getBeforeJson());
                    if (before != null) {
                        existing.setName((String) before.getOrDefault("name", existing.getName()));
                        existing.setStatus((String) before.getOrDefault("status", existing.getStatus()));
                        existing.setOwner((String) before.getOrDefault("owner", existing.getOwner()));
                        @SuppressWarnings("unchecked")
                        Map<String, Object> fd = (Map<String, Object>) before.get("fieldsData");
                        if (fd != null) {
                            existing.setFieldsData(fd);
                        }
                    }
                }
            }
            default -> {}
        }
    }

    private void reverseApplyRelationChange(TopologySnapshot snapshot, AuditLog change, String action) {
        switch (action) {
            case "create_relation" -> {
                // Relation was created after targetTime → remove it
                Map<String, Object> after = parseJson(change.getAfterJson());
                if (after != null) {
                    Long src = toLong(after.get("srcInstanceId"));
                    Long dst = toLong(after.get("dstInstanceId"));
                    String kind = (String) after.get("associationKind");
                    if (src != null && dst != null && kind != null) {
                        snapshot.getEdges().removeIf(e ->
                                e.getSrc().equals(src) && e.getDst().equals(dst) && e.getKind().equals(kind));
                    }
                }
            }
            case "delete_relation" -> {
                // Relation was deleted after targetTime → restore it
                Map<String, Object> before = parseJson(change.getBeforeJson());
                if (before != null) {
                    TopologyEdgeVO edge = restoreEdgeFromJson(before);
                    if (edge != null) {
                        snapshot.getEdges().add(edge);
                    }
                }
            }
            default -> {}
        }
    }

    // ─── Snapshot Comparison ────────────────────────────────────────────────

    private TopologyCompareVO compareSnapshots(TopologySnapshot snapshotA, TopologySnapshot snapshotB) {
        Set<Long> idsA = snapshotA.getNodes().keySet();
        Set<Long> idsB = snapshotB.getNodes().keySet();

        // Added: in B but not in A
        List<TopologyNodeV2VO> added = idsB.stream()
                .filter(id -> !idsA.contains(id))
                .map(id -> snapshotB.getNodes().get(id))
                .collect(Collectors.toList());

        // Removed: in A but not in B
        List<TopologyNodeV2VO> removed = idsA.stream()
                .filter(id -> !idsB.contains(id))
                .map(id -> snapshotA.getNodes().get(id))
                .collect(Collectors.toList());

        // Common nodes
        Set<Long> common = new HashSet<>(idsA);
        common.retainAll(idsB);

        List<TopologyNodeV2VO> modified = new ArrayList<>();
        List<TopologyNodeV2VO> unchanged = new ArrayList<>();

        for (Long id : common) {
            TopologyNodeV2VO nodeA = snapshotA.getNodes().get(id);
            TopologyNodeV2VO nodeB = snapshotB.getNodes().get(id);

            if (isNodeModified(nodeA, nodeB)) {
                modified.add(nodeB);
            } else {
                unchanged.add(nodeB);
            }
        }

        // Edge comparison
        Set<EdgeKey> edgeKeysA = snapshotA.getEdges().stream()
                .map(e -> new EdgeKey(e.getSrc(), e.getDst(), e.getKind()))
                .collect(Collectors.toSet());
        Set<EdgeKey> edgeKeysB = snapshotB.getEdges().stream()
                .map(e -> new EdgeKey(e.getSrc(), e.getDst(), e.getKind()))
                .collect(Collectors.toSet());

        Map<EdgeKey, TopologyEdgeVO> edgeMapB = snapshotB.getEdges().stream()
                .collect(Collectors.toMap(e -> new EdgeKey(e.getSrc(), e.getDst(), e.getKind()), e -> e, (a, b) -> a));
        Map<EdgeKey, TopologyEdgeVO> edgeMapA = snapshotA.getEdges().stream()
                .collect(Collectors.toMap(e -> new EdgeKey(e.getSrc(), e.getDst(), e.getKind()), e -> e, (a, b) -> a));

        List<TopologyCompareEdgeVO> compareEdges = new ArrayList<>();

        // Added edges (in B not in A)
        for (EdgeKey key : edgeKeysB) {
            TopologyCompareEdgeVO ce = new TopologyCompareEdgeVO();
            TopologyEdgeVO e = edgeMapB.get(key);
            ce.setSrc(e.getSrc()); ce.setDst(e.getDst());
            ce.setKind(e.getKind()); ce.setLabel(e.getLabel());
            ce.setStatus(edgeKeysA.contains(key) ? "unchanged" : "added");
            compareEdges.add(ce);
        }

        // Removed edges (in A not in B)
        for (EdgeKey key : edgeKeysA) {
            if (!edgeKeysB.contains(key)) {
                TopologyCompareEdgeVO ce = new TopologyCompareEdgeVO();
                TopologyEdgeVO e = edgeMapA.get(key);
                ce.setSrc(e.getSrc()); ce.setDst(e.getDst());
                ce.setKind(e.getKind()); ce.setLabel(e.getLabel());
                ce.setStatus("removed");
                compareEdges.add(ce);
            }
        }

        TopologyCompareVO result = new TopologyCompareVO();
        result.setAdded(added);
        result.setRemoved(removed);
        result.setModified(modified);
        result.setUnchanged(unchanged);
        result.setEdges(compareEdges);
        return result;
    }

    private boolean isNodeModified(TopologyNodeV2VO a, TopologyNodeV2VO b) {
        if (!Objects.equals(a.getStatus(), b.getStatus())) return true;
        return !Objects.equals(a.getFieldsData(), b.getFieldsData());
    }

    // ─── Conversion Helpers ─────────────────────────────────────────────────

    private TopologyNodeV2VO toV2Node(TopologyNodeVO node) {
        TopologyNodeV2VO v2 = new TopologyNodeV2VO();
        v2.setId(node.getId()); v2.setName(node.getName());
        v2.setModelId(node.getModelId()); v2.setModelName(node.getModelName());
        v2.setModelColor(node.getModelColor()); v2.setStatus(node.getStatus());
        v2.setOwner(node.getOwner()); v2.setRoot(node.isRoot());
        v2.setKeyAttrs(node.getKeyAttrs());
        return v2;
    }

    private TopologyNodeV2VO restoreNodeFromJson(Map<String, Object> json) {
        try {
            TopologyNodeV2VO node = new TopologyNodeV2VO();
            node.setId(toLong(json.get("id")));
            node.setName((String) json.get("name"));
            node.setModelId((String) json.get("modelId"));
            node.setStatus((String) json.get("status"));
            node.setOwner((String) json.get("owner"));
            node.setRoot(false);
            @SuppressWarnings("unchecked")
            Map<String, Object> fd = (Map<String, Object>) json.get("fieldsData");
            node.setFieldsData(fd);
            return node;
        } catch (Exception e) {
            log.warn("Failed to restore node from JSON: {}", e.getMessage());
            return null;
        }
    }

    private TopologyEdgeVO restoreEdgeFromJson(Map<String, Object> json) {
        try {
            TopologyEdgeVO edge = new TopologyEdgeVO();
            edge.setSrc(toLong(json.get("srcInstanceId")));
            edge.setDst(toLong(json.get("dstInstanceId")));
            edge.setKind((String) json.get("associationKind"));
            edge.setLabel(edge.getKind()); // label will be resolved if needed
            return edge;
        } catch (Exception e) {
            log.warn("Failed to restore edge from JSON: {}", e.getMessage());
            return null;
        }
    }

    private Long toLong(Object val) {
        if (val == null) return null;
        if (val instanceof Number) return ((Number) val).longValue();
        try { return Long.parseLong(val.toString()); }
        catch (NumberFormatException e) { return null; }
    }

    private Map<String, Object> parseJson(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return null;
        }
    }
}
