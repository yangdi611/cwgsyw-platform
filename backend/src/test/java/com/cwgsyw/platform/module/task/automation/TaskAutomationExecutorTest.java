package com.cwgsyw.platform.module.task.automation;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.task.automation.entity.TaskAutomationExecution;
import com.cwgsyw.platform.module.task.automation.entity.TaskAutomationRule;
import com.cwgsyw.platform.module.task.automation.mapper.TaskAutomationExecutionMapper;
import com.cwgsyw.platform.module.task.notification.TaskNotificationOutbox;
import com.cwgsyw.platform.module.task.runtime.dto.CreateOneOffTaskRequest;
import com.cwgsyw.platform.module.task.runtime.dto.TaskActionsVO;
import com.cwgsyw.platform.module.task.runtime.dto.TaskSummaryVO;
import com.cwgsyw.platform.module.task.runtime.service.TaskRuntimeService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskAutomationExecutorTest {
    @Mock TaskAutomationExecutionMapper executionMapper;
    @Mock TaskRuntimeService taskRuntimeService;
    @Mock TaskRelationService relationService;
    @Mock TaskNotificationOutbox outbox;
    @Mock UserMapper userMapper;
    @Mock RbacService rbacService;

    private TaskAutomationExecutor executor;

    @BeforeEach
    void setUp() {
        executor = new TaskAutomationExecutor(executionMapper, taskRuntimeService, relationService,
            outbox, userMapper, rbacService);
    }

    @Test
    void createTaskRunsAsCurrentRuleActivatorAndCreatesSourceRelation() {
        TaskAutomationRule rule = createRule();
        TaskAutomationExecution execution = execution();
        LocalDateTime occurredAt = LocalDateTime.of(2026, 7, 23, 9, 0);
        when(userMapper.selectOne(any())).thenReturn(user(3L));
        when(rbacService.getUserPermissions(3L)).thenReturn(Set.of("task:create", "task:update"));
        when(rbacService.getHighestScope(3L)).thenReturn("group");
        when(taskRuntimeService.createOneOff(any(), any())).thenReturn(summary(900L));

        executor.execute(execution, rule,
            new TaskLifecycleEvent("tenant-a", "metric_threshold", 101L, 201L, occurredAt,
                Map.of("metricFactId", 301L)));

        ArgumentCaptor<SecurityUser> actor = ArgumentCaptor.forClass(SecurityUser.class);
        ArgumentCaptor<CreateOneOffTaskRequest> request = ArgumentCaptor.forClass(CreateOneOffTaskRequest.class);
        verify(taskRuntimeService).createOneOff(actor.capture(), request.capture());
        assertThat(actor.getValue().getUserId()).isEqualTo(3L);
        assertThat(actor.getValue().getPermissions()).contains("task:create");
        assertThat(request.getValue().templateVersionId()).isEqualTo(31L);
        assertThat(request.getValue().plannedStartAt()).isEqualTo(occurredAt);
        assertThat(request.getValue().dueAt()).isEqualTo(occurredAt.plusHours(24));
        verify(relationService).create("tenant-a", 101L, 900L, "remediation", 7L);
        assertThat(execution.getStatus()).isEqualTo("succeeded");
        assertThat(execution.getResultTaskId()).isEqualTo(900L);
        verify(executionMapper).updateById(execution);
    }

    @Test
    void createTaskFailsWhenActivatorLostPermission() {
        TaskAutomationRule rule = createRule();
        when(userMapper.selectOne(any())).thenReturn(user(3L));
        when(rbacService.getUserPermissions(3L)).thenReturn(Set.of("task_analytics:update"));

        assertThatThrownBy(() -> executor.execute(execution(), rule,
            new TaskLifecycleEvent("tenant-a", "task_completed", 101L, 201L, LocalDateTime.now())))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("TASK_AUTOMATION_CREATE_FORBIDDEN"));
        verify(taskRuntimeService, never()).createOneOff(any(), any());
        verify(executionMapper, never()).updateById((TaskAutomationExecution) any());
    }

    @Test
    void notifyQueuesValidatedRecipientWithoutRequiringCreatePermission() {
        TaskAutomationRule rule = createRule();
        rule.setActionType("notify");
        rule.setActionConfig(Map.of("recipientId", 6L, "title", "阈值预警"));
        when(userMapper.selectOne(any())).thenReturn(user(6L));

        TaskAutomationExecution execution = execution();
        executor.execute(execution, rule,
            new TaskLifecycleEvent("tenant-a", "metric_threshold", 101L, 201L, LocalDateTime.now(),
                Map.of("metricFactId", 301L)));

        verify(outbox).enqueue(eq("tenant-a"), eq(101L), eq(201L), eq(null), eq("automation_notify"),
            eq(6L), eq("notification"), eq("automation:7"), any(), any());
        verify(rbacService, never()).getUserPermissions(any());
    }

    @Test
    void notifyRejectsMissingOrInactiveRecipient() {
        TaskAutomationRule rule = createRule();
        rule.setActionType("notify");
        rule.setActionConfig(Map.of("recipientId", 6L));
        when(userMapper.selectOne(any())).thenReturn(null);

        assertThatThrownBy(() -> executor.execute(execution(), rule,
            new TaskLifecycleEvent("tenant-a", "task_completed", 101L, 201L, LocalDateTime.now())))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("TASK_AUTOMATION_RECIPIENT_INVALID"));
        verify(outbox, never()).enqueue(any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    private TaskAutomationRule createRule() {
        TaskAutomationRule rule = new TaskAutomationRule();
        rule.setId(11L); rule.setTenantId("tenant-a"); rule.setUpdatedBy(3L); rule.setActionType("create_task");
        rule.setActionConfig(Map.of("templateVersionId", 31L, "assigneeId", 6L,
            "relationType", "remediation", "title", "自动整改"));
        return rule;
    }

    private TaskAutomationExecution execution() {
        TaskAutomationExecution execution = new TaskAutomationExecution();
        execution.setId(7L); execution.setTenantId("tenant-a"); execution.setRuleId(11L);
        execution.setStatus("pending"); execution.setAttemptCount(0);
        return execution;
    }

    private User user(Long id) {
        User user = new User();
        user.setId(id); user.setTenantId("tenant-a"); user.setUsername("user" + id); user.setPassword("secret");
        user.setGroupId(5L); user.setStatus(1); user.setIsDeleted(false);
        return user;
    }

    private TaskSummaryVO summary(Long id) {
        return new TaskSummaryVO(id, "自动整改", null, null, 31L, "整改模板",
            LocalDate.of(2026, 7, 23), LocalDateTime.of(2026, 7, 23, 9, 0),
            LocalDateTime.of(2026, 7, 24, 9, 0), "normal", "not_started", "not_required",
            6L, 5L, false, new TaskActionsVO(false, false, false, false, false, false, false));
    }
}
