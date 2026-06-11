package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.module.changedoc.dto.CiSearchResultVO;
import com.cwgsyw.platform.module.changedoc.dto.CiTopologyResultVO;
import com.cwgsyw.platform.module.cmdb.CiInstanceService;
import com.cwgsyw.platform.module.cmdb.CiTopologyService;
import com.cwgsyw.platform.module.cmdb.dto.CiInstanceSearchResult;
import com.cwgsyw.platform.module.cmdb.dto.CiInstanceSearchVO;
import com.cwgsyw.platform.module.cmdb.dto.CiTopologyResult;
import com.cwgsyw.platform.module.cmdb.dto.TopologyEdgeVO;
import com.cwgsyw.platform.module.cmdb.dto.TopologyNodeVO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChangeDocCiProxyTest {

    @Mock CiInstanceService ciInstanceService;
    @Mock CiTopologyService ciTopologyService;

    @InjectMocks ChangeDocService changeDocService;

    // ── Helpers ─────────────────────────────────────────────────────────────

    private CiInstanceSearchVO searchVo(Long id, String name, String modelId, String modelName) {
        CiInstanceSearchVO vo = new CiInstanceSearchVO();
        vo.setId(id);
        vo.setName(name);
        vo.setModelId(modelId);
        vo.setModelName(modelName);
        return vo;
    }

    private TopologyNodeVO topoNode(Long id, String name, String modelId, String modelName, boolean isRoot) {
        TopologyNodeVO n = new TopologyNodeVO();
        n.setId(id);
        n.setName(name);
        n.setModelId(modelId);
        n.setModelName(modelName);
        n.setIsRoot(isRoot);
        return n;
    }

    private TopologyEdgeVO topoEdge(Long id, Long srcId, Long dstId, String label, String defId) {
        TopologyEdgeVO e = new TopologyEdgeVO();
        e.setId(id);
        e.setSrcId(srcId);
        e.setDstId(dstId);
        e.setLabel(label);
        e.setDefId(defId);
        return e;
    }

    // ── Tests: searchCi ─────────────────────────────────────────────────────

    @Test
    void searchCi_withKeyword_returnsMappedRecords() {
        var cmdbRecord = searchVo(1L, "web-server-01", "server", "服务器");
        CiInstanceSearchResult cmdbResult = new CiInstanceSearchResult();
        cmdbResult.setRecords(List.of(cmdbRecord));
        cmdbResult.setTotal(1);

        when(ciInstanceService.searchAcrossModels(eq("tenant1"), eq("web"), isNull(), eq(1), eq(10)))
                .thenReturn(cmdbResult);

        CiSearchResultVO result = changeDocService.searchCi("tenant1", "web", 10);

        assertNotNull(result);
        assertEquals(1, result.getTotal());
        assertEquals(1, result.getRecords().size());
        assertEquals(1L, result.getRecords().get(0).getId());
        assertEquals("web-server-01", result.getRecords().get(0).getName());
        assertEquals("server", result.getRecords().get(0).getModelId());
        assertEquals("服务器", result.getRecords().get(0).getModelName());
    }

    @Test
    void searchCi_emptyKeyword_returnsEmptyList() {
        CiInstanceSearchResult cmdbResult = new CiInstanceSearchResult();
        cmdbResult.setRecords(List.of());
        cmdbResult.setTotal(0);

        when(ciInstanceService.searchAcrossModels(eq("tenant1"), eq(""), isNull(), eq(1), eq(10)))
                .thenReturn(cmdbResult);

        CiSearchResultVO result = changeDocService.searchCi("tenant1", "", 10);

        assertNotNull(result);
        assertEquals(0, result.getTotal());
        assertTrue(result.getRecords().isEmpty());
    }

    @Test
    void searchCi_sizeExceeded_clampedTo50() {
        CiInstanceSearchResult cmdbResult = new CiInstanceSearchResult();
        cmdbResult.setRecords(List.of());
        cmdbResult.setTotal(0);

        when(ciInstanceService.searchAcrossModels(eq("tenant1"), eq("db"), isNull(), eq(1), eq(50)))
                .thenReturn(cmdbResult);

        // Pass size=100, should be clamped to 50
        changeDocService.searchCi("tenant1", "db", 100);

        verify(ciInstanceService).searchAcrossModels("tenant1", "db", null, 1, 50);
    }

    @Test
    void searchCi_sizeBelowMin_clampedTo1() {
        CiInstanceSearchResult cmdbResult = new CiInstanceSearchResult();
        cmdbResult.setRecords(List.of());
        cmdbResult.setTotal(0);

        when(ciInstanceService.searchAcrossModels(eq("tenant1"), eq("x"), isNull(), eq(1), eq(1)))
                .thenReturn(cmdbResult);

        // Pass size=0, should be clamped to 1
        changeDocService.searchCi("tenant1", "x", 0);

        verify(ciInstanceService).searchAcrossModels("tenant1", "x", null, 1, 1);
    }

    // ── Tests: getCiTopology ────────────────────────────────────────────────

    @Test
    void getCiTopology_validId_returnsNodesAndEdges() {
        TopologyNodeVO node1 = topoNode(1L, "web-server-01", "server", "服务器", true);
        TopologyNodeVO node2 = topoNode(2L, "app-01", "app", "应用", false);
        TopologyEdgeVO edge = topoEdge(10L, 1L, 2L, "部署在", "app_dep_on_host");

        CiTopologyResult cmdbResult = new CiTopologyResult();
        cmdbResult.setNodes(List.of(node1, node2));
        cmdbResult.setEdges(List.of(edge));

        when(ciTopologyService.getTopology(eq("tenant1"), eq(1L), eq(2)))
                .thenReturn(cmdbResult);

        CiTopologyResultVO result = changeDocService.getCiTopology("tenant1", 1L, 2);

        assertNotNull(result);
        assertEquals(2, result.getNodes().size());
        assertEquals(1, result.getEdges().size());

        // Check root node
        CiTopologyResultVO.TopoNode root = result.getNodes().get(0);
        assertEquals(1L, root.getId());
        assertEquals("web-server-01", root.getName());
        assertEquals("server", root.getModelId());
        assertEquals("服务器", root.getModelName());
        assertTrue(root.isRoot());

        // Check non-root node
        CiTopologyResultVO.TopoNode child = result.getNodes().get(1);
        assertEquals(2L, child.getId());
        assertFalse(child.isRoot());

        // Check edge
        CiTopologyResultVO.TopoEdge mappedEdge = result.getEdges().get(0);
        assertEquals(10L, mappedEdge.getId());
        assertEquals(1L, mappedEdge.getSrcId());
        assertEquals(2L, mappedEdge.getDstId());
        assertEquals("部署在", mappedEdge.getLabel());
        assertEquals("app_dep_on_host", mappedEdge.getDefId());
    }

    @Test
    void getCiTopology_invalidDepth_clamped() {
        CiTopologyResult cmdbResult = new CiTopologyResult();
        cmdbResult.setNodes(List.of());
        cmdbResult.setEdges(List.of());

        // depth=0 should be clamped to 1
        when(ciTopologyService.getTopology(eq("tenant1"), eq(1L), eq(1)))
                .thenReturn(cmdbResult);
        changeDocService.getCiTopology("tenant1", 1L, 0);
        verify(ciTopologyService).getTopology("tenant1", 1L, 1);

        // depth=10 should be clamped to 5
        when(ciTopologyService.getTopology(eq("tenant1"), eq(1L), eq(5)))
                .thenReturn(cmdbResult);
        changeDocService.getCiTopology("tenant1", 1L, 10);
        verify(ciTopologyService).getTopology("tenant1", 1L, 5);
    }

    @Test
    void getCiTopology_nonexistentId_returnsEmptyResult() {
        CiTopologyResult cmdbResult = new CiTopologyResult();
        cmdbResult.setNodes(List.of());
        cmdbResult.setEdges(List.of());

        when(ciTopologyService.getTopology(eq("tenant1"), eq(999L), eq(2)))
                .thenReturn(cmdbResult);

        CiTopologyResultVO result = changeDocService.getCiTopology("tenant1", 999L, 2);

        assertNotNull(result);
        assertTrue(result.getNodes().isEmpty());
        assertTrue(result.getEdges().isEmpty());
    }
}
