package com.cwgsyw.platform.module.task.metric;

import com.cwgsyw.platform.module.task.metric.dto.MetricGoalRequest;
import com.cwgsyw.platform.module.task.metric.dto.MetricPreviewRequest;
import com.cwgsyw.platform.module.task.metric.dto.MetricPreviewVO;
import com.cwgsyw.platform.module.task.metric.entity.TaskMetricDefinition;
import com.cwgsyw.platform.module.task.metric.entity.TaskMetricGoal;
import com.cwgsyw.platform.module.task.metric.mapper.TaskMetricDefinitionMapper;
import com.cwgsyw.platform.module.task.metric.mapper.TaskMetricGoalMapper;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class TaskMetricGoalServiceTest {
    @Mock TaskMetricGoalMapper goalMapper;
    @Mock TaskMetricDefinitionMapper definitionMapper;
    @Mock TaskMetricService metricService;

    private TaskMetricGoalService service;
    private SecurityUser user;

    @BeforeEach
    void setUp() {
        service = new TaskMetricGoalService(goalMapper, definitionMapper, metricService);
        user = new SecurityUser(7L, "operator", "", "tenant-a", 3L, "group", Set.of("task_analytics:create"));
        TaskMetricDefinition metric = new TaskMetricDefinition();
        metric.setId(8L); metric.setTenantId("tenant-a"); metric.setName("巡检次数");
        lenient().when(definitionMapper.selectOne(any())).thenReturn(metric);
        lenient().when(metricService.previewForScope(any(), eq(8L), any(), any(), any())).thenReturn(
            new MetricPreviewVO(8L, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31),
                new BigDecimal("12"), null, null, "fact", 3, java.util.List.of(1L),
                java.util.List.of(2L), java.util.List.of(3L)));
    }

    @Test
    void userGoalUsesUserScopedAuthoritativePreview() {
        MetricGoalRequest request = request("user", "23");

        service.create(user, request);

        ArgumentCaptor<MetricPreviewRequest> preview = ArgumentCaptor.forClass(MetricPreviewRequest.class);
        verify(metricService).previewForScope(eq(user), eq(8L), preview.capture(), eq("user"), eq("23"));
        assertThat(preview.getValue().groupId()).isNull();
    }

    @Test
    void templateGoalUsesTemplateScopedAuthoritativePreview() {
        service.create(user, request("template", "44"));

        verify(metricService).previewForScope(eq(user), eq(8L), any(MetricPreviewRequest.class), eq("template"), eq("44"));
    }

    @Test
    void deletePhysicallyRemovesTheCurrentGoal() {
        TaskMetricGoal goal = new TaskMetricGoal();
        goal.setId(9L);
        goal.setTenantId("tenant-a");
        when(goalMapper.selectOne(any())).thenReturn(goal);

        service.delete(user, 9L);

        verify(goalMapper).deleteById(goal);
    }

    private MetricGoalRequest request(String scopeType, String scopeKey) {
        return new MetricGoalRequest(8L, scopeType, scopeKey, "monthly", Map.of(), new BigDecimal("10"),
            new BigDecimal("8"), new BigDecimal("5"), "at_least",
            LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31));
    }
}
