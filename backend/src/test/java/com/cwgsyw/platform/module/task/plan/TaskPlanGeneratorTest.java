package com.cwgsyw.platform.module.task.plan;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.task.plan.entity.TaskPlan;
import com.cwgsyw.platform.module.task.plan.mapper.TaskPlanGenerationMapper;
import com.cwgsyw.platform.module.task.plan.mapper.TaskPlanMapper;
import com.cwgsyw.platform.module.task.plan.scheduler.TaskOccurrenceCalculator;
import com.cwgsyw.platform.module.task.plan.service.CiScopeResolver;
import com.cwgsyw.platform.module.task.plan.service.TaskAssignmentResolver;
import com.cwgsyw.platform.module.task.plan.service.TaskGenerationExecutor;
import com.cwgsyw.platform.module.task.plan.service.TaskPlanGenerator;
import com.cwgsyw.platform.module.task.template.entity.TaskTemplateVersion;
import com.cwgsyw.platform.module.task.template.mapper.TaskTemplateVersionMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskPlanGeneratorTest {
    @Mock TaskPlanMapper planMapper;
    @Mock TaskPlanGenerationMapper generationMapper;
    @Mock TaskTemplateVersionMapper templateVersionMapper;
    @Mock TaskOccurrenceCalculator occurrenceCalculator;
    @Mock TaskAssignmentResolver assignmentResolver;
    @Mock CiScopeResolver ciScopeResolver;
    @Mock TaskGenerationExecutor executor;
    @Mock TransactionTemplate transactionTemplate;

    private TaskPlanGenerator generator;

    @BeforeEach
    void setUp() {
        generator = new TaskPlanGenerator(planMapper, generationMapper, templateVersionMapper,
            occurrenceCalculator, assignmentResolver, ciScopeResolver, executor, transactionTemplate);
        when(templateVersionMapper.selectById(10L)).thenReturn(template());
        when(occurrenceCalculator.calculate(any(), any(), any(), any(), any())).thenReturn(List.of());
    }

    @Test
    void firstRunStartsAtBeginningOfCurrentDaySoPastTodayOccurrenceIsNotSkipped() {
        TaskPlan plan = plan();
        LocalDateTime now = LocalDateTime.of(2026, 7, 23, 9, 1);

        generator.generatePlan(plan, now);

        assertThat(capturedWindowStart()).isEqualTo(LocalDateTime.of(2026, 7, 23, 0, 0));
    }

    @Test
    void firstRunDoesNotStartBeforeFuturePlanStartDate() {
        TaskPlan plan = plan();
        plan.setStartDate(LocalDate.of(2026, 7, 25));

        generator.generatePlan(plan, LocalDateTime.of(2026, 7, 23, 9, 1));

        assertThat(capturedWindowStart()).isEqualTo(LocalDateTime.of(2026, 7, 25, 0, 0));
    }

    @Test
    void subsequentRunStartsImmediatelyAfterPreviousGenerationCursor() {
        TaskPlan plan = plan();
        plan.setLastGeneratedAt(LocalDateTime.of(2026, 7, 22, 15, 30));

        generator.generatePlan(plan, LocalDateTime.of(2026, 7, 23, 9, 1));

        assertThat(capturedWindowStart()).isEqualTo(LocalDateTime.of(2026, 7, 22, 15, 30, 0, 1));
    }

    @Test
    void leavesPlanReadyForRetryWhenNoActiveAssignmentTargetsExist() {
        TaskPlan plan = plan();
        LocalDateTime now = LocalDateTime.of(2026, 7, 23, 9, 1);
        when(planMapper.findDuePlans(now, 100)).thenReturn(List.of(plan));
        when(occurrenceCalculator.calculate(any(), any(), any(), any(), any()))
            .thenReturn(List.of(now));
        when(assignmentResolver.resolve(any(), any(), any(), any()))
            .thenThrow(BusinessException.badRequest("ASSIGNMENT_TARGET_EMPTY", "分配规则没有命中有效执行对象"));

        assertThat(generator.generateDuePlans(now, 100)).isZero();

        verify(planMapper, never()).updateById(any(TaskPlan.class));
    }

    private LocalDateTime capturedWindowStart() {
        ArgumentCaptor<LocalDateTime> start = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(occurrenceCalculator).calculate(eq("tenant-a"), eq("daily"), eq(Map.of("time", "09:00")),
            start.capture(), any(LocalDateTime.class));
        return start.getValue();
    }

    private TaskPlan plan() {
        TaskPlan plan = new TaskPlan();
        plan.setId(1L);
        plan.setTenantId("tenant-a");
        plan.setTemplateVersionId(10L);
        plan.setScheduleType("daily");
        plan.setScheduleConfig(Map.of("time", "09:00"));
        plan.setGenerateAheadDays(7);
        plan.setStatus("active");
        return plan;
    }

    private TaskTemplateVersion template() {
        TaskTemplateVersion template = new TaskTemplateVersion();
        template.setId(10L);
        template.setTenantId("tenant-a");
        return template;
    }
}
