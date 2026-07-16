package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.module.cmdb.dto.impact.ImpactAnalysisRequest;
import com.cwgsyw.platform.module.cmdb.dto.impact.ImpactAnalysisResultVO;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationDefMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationKindMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceRelMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.cmdb.service.ImpactAnalysisService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ImpactAnalysisServiceTest {

    @Mock private CiInstanceMapper ciInstanceMapper;
    @Mock private CiInstanceRelMapper ciInstanceRelMapper;
    @Mock private CiModelMapper ciModelMapper;
    @Mock private CiAssociationKindMapper ciAssociationKindMapper;
    @Mock private CiAssociationDefMapper ciAssociationDefMapper;
    @Mock private JdbcTemplate jdbcTemplate;
    @InjectMocks private ImpactAnalysisService service;

    @BeforeEach
    void setUp() {
        CiInstance root = instance(1L, "root");
        CiInstance leaf = instance(2L, "leaf");
        when(ciInstanceMapper.selectById(1L)).thenReturn(root);
        when(ciInstanceRelMapper.selectCount(any())).thenReturn(1L);
    }

    @Test
    void downstreamCteBindsEveryPlaceholderAndReturnsReachableNode() {
        CiInstance root = instance(1L, "root");
        CiInstance leaf = instance(2L, "leaf");
        when(ciInstanceMapper.selectBatchIds(any())).thenReturn(List.of(root, leaf));
        when(ciAssociationKindMapper.selectList(any())).thenReturn(List.of());
        when(ciAssociationDefMapper.selectList(any())).thenReturn(List.of());
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of(Map.of("src", 1L, "dst", 2L, "kind", "depends_on", "node_id", 2L, "depth", 1)));
        ImpactAnalysisRequest request = new ImpactAnalysisRequest();
        request.setDirection("downstream");
        request.setMaxDepth(2);

        ImpactAnalysisResultVO result = service.analyze(1L, request, "default");

        ArgumentCaptor<Object[]> parameters = ArgumentCaptor.forClass(Object[].class);
        org.mockito.Mockito.verify(jdbcTemplate).queryForList(anyString(), parameters.capture());
        assertThat(parameters.getValue()).containsExactly(1L, 1L, "default", 2, "default");
        assertThat(result.getEdges()).hasSize(1);
        assertThat(result.getLayers()).flatExtracting(layer -> layer.getNodes())
                .extracting(node -> node.getId()).contains(1L, 2L);
    }

    @Test
    void cteFailureIsNotReportedAsTruncatedSuccess() {
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class)))
                .thenThrow(new IllegalStateException("database unavailable"));
        ImpactAnalysisRequest request = new ImpactAnalysisRequest();
        request.setDirection("bidirectional");
        request.setMaxDepth(2);

        assertThatThrownBy(() -> service.analyze(1L, request, "default"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("影响分析查询失败，请稍后重试");
    }

    @Test
    void bidirectionalCteBindsPathAndRootParameters() {
        CiInstance root = instance(1L, "root");
        CiInstance leaf = instance(2L, "leaf");
        when(ciInstanceMapper.selectBatchIds(any())).thenReturn(List.of(root, leaf));
        when(ciAssociationKindMapper.selectList(any())).thenReturn(List.of());
        when(ciAssociationDefMapper.selectList(any())).thenReturn(List.of());
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of(Map.of("src", 1L, "dst", 2L, "kind", "depends_on", "node_id", 2L, "depth", 1)));
        ImpactAnalysisRequest request = new ImpactAnalysisRequest();
        request.setDirection("bidirectional");
        request.setMaxDepth(2);

        service.analyze(1L, request, "default");

        ArgumentCaptor<Object[]> parameters = ArgumentCaptor.forClass(Object[].class);
        org.mockito.Mockito.verify(jdbcTemplate).queryForList(anyString(), parameters.capture());
        assertThat(parameters.getValue()).containsExactly(1L, 1L, 1L, 1L, 1L, "default", 2, "default");
    }

    @Test
    void cteKeepsNodesAtTheirShortestDepthWhenCyclesReturnThemLater() {
        CiInstance root = instance(1L, "root");
        CiInstance first = instance(2L, "first");
        CiInstance second = instance(3L, "second");
        when(ciInstanceMapper.selectBatchIds(any())).thenReturn(List.of(root, first, second));
        when(ciAssociationKindMapper.selectList(any())).thenReturn(List.of());
        when(ciAssociationDefMapper.selectList(any())).thenReturn(List.of());
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(
                Map.of("src", 1L, "dst", 2L, "kind", "depends_on", "node_id", 2L, "depth", 1),
                Map.of("src", 2L, "dst", 3L, "kind", "depends_on", "node_id", 3L, "depth", 2),
                Map.of("src", 3L, "dst", 2L, "kind", "depends_on", "node_id", 2L, "depth", 3)
        ));
        ImpactAnalysisRequest request = new ImpactAnalysisRequest();
        request.setDirection("bidirectional");
        request.setMaxDepth(3);

        ImpactAnalysisResultVO result = service.analyze(1L, request, "default");

        assertThat(result.getLayers()).flatExtracting(layer -> layer.getNodes())
                .extracting(node -> node.getId())
                .containsExactlyInAnyOrder(1L, 2L, 3L);
        assertThat(result.getLayers()).filteredOn(layer -> layer.getDepth() == 3)
                .flatExtracting(layer -> layer.getNodes())
                .isEmpty();
    }

    private CiInstance instance(Long id, String name) {
        CiInstance instance = new CiInstance();
        instance.setId(id);
        instance.setTenantId("default");
        instance.setModelId("host");
        instance.setName(name);
        instance.setStatus("online");
        instance.setIsDeleted(false);
        return instance;
    }
}
