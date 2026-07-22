package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.topology.TopologyCompareVO;
import com.cwgsyw.platform.module.cmdb.dto.topology.TopologyEdgeVO;
import com.cwgsyw.platform.module.cmdb.dto.topology.TopologyNodeVO;
import com.cwgsyw.platform.module.cmdb.dto.topology.TopologyResultVO;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationKindMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceRelMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.cmdb.service.CiTopologyCompareService;
import com.cwgsyw.platform.module.cmdb.service.CiTopologyService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CiTopologyCompareServiceTest {

    @Mock private CiTopologyService ciTopologyService;
    @Mock private AuditLogMapper auditLogMapper;
    @Mock private CiInstanceMapper ciInstanceMapper;
    @Mock private CiModelMapper ciModelMapper;
    @Mock private CiAttributeMapper ciAttributeMapper;
    @Mock private CiAssociationKindMapper ciAssociationKindMapper;
    @Mock private CiInstanceRelMapper ciInstanceRelMapper;
    private CiTopologyCompareService service;

    @BeforeEach
    void setUp() {
        service = new CiTopologyCompareService(ciTopologyService, auditLogMapper, ciInstanceMapper,
                ciModelMapper, ciAttributeMapper, ciAssociationKindMapper, ciInstanceRelMapper,
                new ObjectMapper());
    }

    @Test
    void reconstructsAddedModifiedAndRemovedNodesFromStrictlyLaterAudits() {
        when(ciTopologyService.getTopology(1L, 3, "default")).thenReturn(currentTopology());
        when(ciInstanceMapper.selectBatchIds(any())).thenReturn(List.of());
        when(auditLogMapper.queryChangesList(eq("default"), any(), eq("2026-01-01T10:00:00")))
                .thenReturn(List.of(
                        audit("delete_instance", "ci_instance", 4L,
                                "{\"id\":4,\"modelId\":\"host\",\"name\":\"removed\",\"status\":\"online\",\"fieldsData\":{}}", null),
                        audit("create_instance", "ci_instance", 3L, null,
                                "{\"id\":3,\"modelId\":\"host\",\"name\":\"added\",\"status\":\"online\",\"fieldsData\":{}}"),
                        audit("update_instance", "ci_instance", 2L,
                                "{\"id\":2,\"modelId\":\"host\",\"name\":\"modified\",\"status\":\"online\",\"fieldsData\":{\"zone\":\"a\"}}",
                                "{\"id\":2,\"modelId\":\"host\",\"name\":\"modified\",\"status\":\"maintenance\",\"fieldsData\":{\"zone\":\"b\"}}")
                ));
        when(auditLogMapper.queryChangesList(eq("default"), any(), eq("2026-01-01T11:00:00")))
                .thenReturn(List.of());

        TopologyCompareVO result = service.compare(1L, "2026-01-01T10:00:00", "2026-01-01T11:00:00", 3, "default");

        assertThat(result.getAdded()).extracting(node -> node.getId()).containsExactly(3L);
        assertThat(result.getRemoved()).extracting(node -> node.getId()).containsExactly(4L);
        assertThat(result.getModified()).extracting(node -> node.getId()).containsExactly(2L);
        assertThat(result.getUnchanged()).extracting(node -> node.getId()).containsExactly(1L);
    }

    private TopologyResultVO currentTopology() {
        TopologyResultVO topology = new TopologyResultVO();
        topology.setNodes(List.of(node(1L, "root", "online", Map.of()), node(2L, "modified", "maintenance", Map.of("zone", "b")), node(3L, "added", "online", Map.of())));
        topology.setEdges(List.of(edge(1L, 2L), edge(1L, 3L)));
        return topology;
    }

    private TopologyNodeVO node(Long id, String name, String status, Map<String, Object> fieldsData) {
        TopologyNodeVO node = new TopologyNodeVO();
        node.setId(id); node.setName(name); node.setModelId("host"); node.setStatus(status); node.setKeyAttrs(fieldsData); node.setRoot(id == 1L);
        return node;
    }

    private TopologyEdgeVO edge(Long src, Long dst) {
        TopologyEdgeVO edge = new TopologyEdgeVO();
        edge.setSrc(src); edge.setDst(dst); edge.setKind("depends_on"); edge.setLabel("depends on");
        return edge;
    }

    private AuditLog audit(String action, String targetType, Long targetId, String before, String after) {
        return AuditLog.builder().tenantId("default").module("cmdb").action(action).targetType(targetType)
                .targetId(targetId).beforeJson(before).afterJson(after).createdAt(LocalDateTime.now()).build();
    }
}
