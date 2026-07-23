package com.cwgsyw.platform.module.task.automation;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.task.automation.dto.AutomationRuleRequest;
import com.cwgsyw.platform.module.task.automation.entity.TaskAutomationExecution;
import com.cwgsyw.platform.module.task.automation.entity.TaskAutomationRule;
import com.cwgsyw.platform.module.task.automation.mapper.TaskAutomationExecutionMapper;
import com.cwgsyw.platform.module.task.automation.mapper.TaskAutomationRuleMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskInstanceMapper;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateVersionVO;
import com.cwgsyw.platform.module.task.template.service.TaskTemplateService;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskAutomationServiceTest {
    @Mock TaskAutomationRuleMapper ruleMapper;
    @Mock TaskAutomationExecutionMapper executionMapper;
    @Mock TaskAutomationExecutor executor;
    @Mock TaskAutomationFailureRecorder failureRecorder;
    @Mock TaskAutomationConditionEvaluator conditionEvaluator;
    @Mock TaskTemplateService templateService;
    @Mock TaskInstanceMapper taskMapper;

    private TaskAutomationService service;

    @BeforeEach
    void setUp() {
        service = new TaskAutomationService(ruleMapper, executionMapper, executor, failureRecorder, conditionEvaluator,
            templateService, taskMapper, new ObjectMapper());
    }

    @Test
    void replayedLifecycleEventDoesNotRunTheRuleAgain() {
        TaskAutomationRule rule = activeCreateRule();
        when(ruleMapper.selectList(any())).thenReturn(List.of(rule));
        when(conditionEvaluator.matches(any(), any())).thenReturn(true);
        when(executionMapper.claim(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(0);

        service.onEvent(new TaskLifecycleEvent("tenant-a", "task_completed", 101L, 201L, LocalDateTime.now()));

        verify(executionMapper).claim(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(executor, never()).execute(any(), any(), any());
        verify(failureRecorder, never()).record(any(), any());
    }

    @Test
    void executionFailureIsRecordedWithoutRethrowingToTheSourceEvent() {
        TaskAutomationRule rule = activeCreateRule();
        TaskAutomationExecution execution = execution(7L, "pending");
        when(ruleMapper.selectList(any())).thenReturn(List.of(rule));
        when(conditionEvaluator.matches(any(), any())).thenReturn(true);
        when(executionMapper.claim(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(1);
        when(executionMapper.selectOne(any())).thenReturn(execution);
        RuntimeException failure = new RuntimeException("invalid assignee");
        org.mockito.Mockito.doThrow(failure).when(executor).execute(any(), any(), any());

        service.onEvent(new TaskLifecycleEvent("tenant-a", "task_completed", 101L, 201L, LocalDateTime.now()));

        verify(failureRecorder).record(execution, failure);
    }

    @Test
    void unmatchedConditionDoesNotClaimExecution() {
        when(ruleMapper.selectList(any())).thenReturn(List.of(activeCreateRule()));
        when(conditionEvaluator.matches(any(), any())).thenReturn(false);

        service.onEvent(new TaskLifecycleEvent("tenant-a", "task_completed", 101L, 201L, LocalDateTime.now()));

        verify(executionMapper, never()).claim(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(executor, never()).execute(any(), any(), any());
    }

    @Test
    void metricFactSourceProducesStableDedupeKey() {
        TaskAutomationRule rule = activeCreateRule();
        rule.setTriggerType("metric_threshold");
        when(ruleMapper.selectList(any())).thenReturn(List.of(rule));
        when(conditionEvaluator.matches(any(), any())).thenReturn(true);
        when(executionMapper.claim(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(0);

        service.onEvent(new TaskLifecycleEvent("tenant-a", "metric_threshold", 101L, 201L,
            LocalDateTime.now(), Map.of("metricFactId", 301L, "metricId", 9L, "metricValue", 2)));

        verify(executionMapper).claim(eq("tenant-a"), eq(11L), eq("metric_fact"), eq(301L),
            eq("metric_threshold"), eq(101L), eq(201L), any(), any(),
            eq("11:metric_threshold:metric_fact:301"), any());
    }

    @Test
    void retryReplaysOriginalEventContext() {
        LocalDateTime occurredAt = LocalDateTime.of(2026, 7, 20, 11, 30);
        TaskAutomationExecution initial = execution(7L, "failed");
        initial.setEventType("metric_threshold");
        initial.setSourceType("metric_fact");
        initial.setSourceId(301L);
        initial.setSourceTaskId(101L);
        initial.setSourceSubmissionId(201L);
        initial.setSourceOccurredAt(occurredAt);
        initial.setSourceAttributes(Map.of("metricFactId", 301L, "metricId", 9L, "metricValue", 4));
        TaskAutomationExecution pending = execution(7L, "pending");
        pending.setEventType(initial.getEventType()); pending.setSourceType(initial.getSourceType());
        pending.setSourceId(initial.getSourceId()); pending.setSourceTaskId(initial.getSourceTaskId());
        pending.setSourceSubmissionId(initial.getSourceSubmissionId()); pending.setSourceOccurredAt(occurredAt);
        pending.setSourceAttributes(initial.getSourceAttributes());
        when(executionMapper.selectOne(any())).thenReturn(initial, pending);
        when(executionMapper.requeue(eq("tenant-a"), eq(7L), any())).thenReturn(1);
        when(executionMapper.claimPending(eq("tenant-a"), eq(7L), any(), any())).thenReturn(1);
        when(ruleMapper.selectOne(any())).thenReturn(activeCreateRule());
        SecurityUser user = new SecurityUser(3L, "creator", "", "tenant-a", null, "tenant",
            Set.of("task_analytics:update"));

        service.retry(user, 7L);

        ArgumentCaptor<TaskLifecycleEvent> event = ArgumentCaptor.forClass(TaskLifecycleEvent.class);
        verify(executor).execute(eq(pending), any(), event.capture());
        assertThat(event.getValue().taskId()).isEqualTo(101L);
        assertThat(event.getValue().submissionId()).isEqualTo(201L);
        assertThat(event.getValue().occurredAt()).isEqualTo(occurredAt);
        assertThat(event.getValue().attributes()).containsEntry("metricFactId", 301L)
            .containsEntry("metricValue", 4);
    }

    @Test
    void cannotActivateTaskCreatingRuleWithoutTaskCreatePermission() {
        TaskAutomationRule rule = activeCreateRule();
        rule.setStatus("draft");
        when(ruleMapper.selectOne(any())).thenReturn(rule);
        SecurityUser analyst = new SecurityUser(3L, "analyst", "", "tenant-a", null, "tenant", Set.of("task_analytics:update"));

        assertThatThrownBy(() -> service.activate(analyst, 11L))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> org.assertj.core.api.Assertions.assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("TASK_AUTOMATION_CREATE_FORBIDDEN"));
        verify(templateService, never()).getVersion(any(), any());
    }

    @Test
    void activatesOnlyWhenTheConfiguredTemplateIsPublished() {
        TaskAutomationRule rule = activeCreateRule();
        rule.setStatus("draft");
        when(ruleMapper.selectOne(any())).thenReturn(rule);
        when(templateService.getVersion("tenant-a", 31L)).thenReturn(TaskTemplateVersionVO.builder().id(31L).status("published").build());
        SecurityUser creator = new SecurityUser(3L, "creator", "", "tenant-a", null, "tenant",
            Set.of("task_analytics:update", "task:create"));

        service.activate(creator, 11L);

        verify(ruleMapper).updateById(rule);
    }

    @Test
    void deleteArchivesTheRuleWithoutDeletingItsExecutionHistoryParent() {
        TaskAutomationRule rule = activeCreateRule();
        when(ruleMapper.selectOne(any())).thenReturn(rule);
        SecurityUser user = new SecurityUser(3L, "creator", "", "tenant-a", null, "tenant", Set.of("task_analytics:delete"));

        service.delete(user, 11L);

        assertThat(rule.getStatus()).isEqualTo("archived");
        assertThat(rule.getUpdatedBy()).isEqualTo(3L);
        verify(ruleMapper).updateById(rule);
    }

    private TaskAutomationRule activeCreateRule() {
        TaskAutomationRule rule = new TaskAutomationRule();
        rule.setId(11L);
        rule.setTenantId("tenant-a");
        rule.setName("生成整改");
        rule.setTriggerType("task_completed");
        rule.setActionType("create_task");
        rule.setActionConfig(Map.of("templateVersionId", 31L, "assigneeId", 6L));
        rule.setStatus("active");
        rule.setUpdatedBy(3L);
        return rule;
    }

    private TaskAutomationExecution execution(Long id, String status) {
        TaskAutomationExecution execution = new TaskAutomationExecution();
        execution.setId(id);
        execution.setTenantId("tenant-a");
        execution.setRuleId(11L);
        execution.setStatus(status);
        return execution;
    }
}
