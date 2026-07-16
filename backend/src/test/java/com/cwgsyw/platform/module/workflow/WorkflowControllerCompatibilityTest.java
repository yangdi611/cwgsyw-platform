package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.config.SysConfigService;
import com.cwgsyw.platform.module.workflow.dto.ApproveRequest;
import com.cwgsyw.platform.module.workflow.dto.HistoricActivityVO;
import com.cwgsyw.platform.module.workflow.dto.ProcessStatsVO;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowRuntimeFacade;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowTaskCompleteCommand;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowTaskSummary;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.prepost.PreAuthorize;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowControllerCompatibilityTest {
    @Mock WorkflowService workflowService;
    @Mock WorkflowRuntimeFacade workflowRuntimeFacade;
    @Mock AuditLogMapper auditLogMapper;
    @Mock SysConfigService configService;

    @InjectMocks WorkflowController controller;

    private final SecurityUser user = new SecurityUser(
        7L, "approver", "", "tenant-a", 3L, "group", Set.of("daily_report:approve"));

    @Test
    void legacyGroupTasks_mapsUnifiedCandidateResultsToLegacyContract() {
        WorkflowTaskSummary task = WorkflowTaskSummary.builder()
            .taskId("task-1").processInstanceId("pi-1").taskName("日报审批")
            .businessKey("daily_report:42").businessType("daily_report").businessId("42")
            .createTime(LocalDateTime.of(2026, 7, 15, 12, 0)).build();
        when(workflowRuntimeFacade.listGroupTasks(user)).thenReturn(List.of(task));

        var response = controller.groupTasks(user);

        assertThat(response.getData()).singleElement().satisfies(result -> {
            assertThat(result.getTaskId()).isEqualTo("task-1");
            assertThat(result.getBusinessType()).isEqualTo("daily_report");
            assertThat(result.getBusinessId()).isEqualTo(42L);
        });
        verify(workflowRuntimeFacade).listGroupTasks(user);
    }

    @Test
    void legacyApprove_delegatesToUnifiedCompletionCommand() {
        ApproveRequest request = new ApproveRequest();
        request.setTaskId("task-1");
        request.setApproved(true);
        request.setComment("通过");

        controller.approve(request, user);

        ArgumentCaptor<WorkflowTaskCompleteCommand> command = ArgumentCaptor.forClass(WorkflowTaskCompleteCommand.class);
        verify(workflowRuntimeFacade).completeTask(command.capture());
        assertThat(command.getValue()).satisfies(value -> {
            assertThat(value.getTenantId()).isEqualTo("tenant-a");
            assertThat(value.getTaskId()).isEqualTo("task-1");
            assertThat(value.getOperatorId()).isEqualTo(7L);
            assertThat(value.isApproved()).isTrue();
            assertThat(value.getComment()).isEqualTo("通过");
        });
    }

    @Test
    void unifiedGroupEndpoints_keepDailyApprovalPermissionCompatibleWithLegacyEndpoints() throws Exception {
        assertThat(WorkflowCenterController.class.getMethod("groupTasks", SecurityUser.class)
            .getAnnotation(PreAuthorize.class).value()).isEqualTo("hasPermission('daily_report', 'approve')");
        assertThat(WorkflowCenterController.class.getMethod("complete", WorkflowCenterController.CompleteTaskRequest.class,
            SecurityUser.class).getAnnotation(PreAuthorize.class).value())
            .isEqualTo("hasPermission('daily_report', 'approve')");
    }

    @Test
    void workflowReadModels_useTypedCamelCaseContracts() {
        ProcessStatsVO stats = new ProcessStatsVO();
        stats.setProcessDefinitionKey("daily_report");
        stats.setTotalStarted(2);
        stats.setAvgDurationSeconds(0D);
        HistoricActivityVO activity = new HistoricActivityVO();
        activity.setActivityId("end");
        activity.setEndTime(LocalDateTime.of(2026, 7, 16, 10, 0));
        when(workflowService.getAllProcessStats()).thenReturn(List.of(stats));
        when(workflowService.getHistoricActivities("instance-1")).thenReturn(List.of(activity));

        assertThat(controller.allStats().getData()).singleElement().satisfies(result -> {
            assertThat(result.getProcessDefinitionKey()).isEqualTo("daily_report");
            assertThat(result.getAvgDurationSeconds()).isZero();
        });
        assertThat(controller.activities("instance-1").getData()).singleElement().satisfies(result ->
            assertThat(result.getEndTime()).isEqualTo(LocalDateTime.of(2026, 7, 16, 10, 0)));
    }
}
