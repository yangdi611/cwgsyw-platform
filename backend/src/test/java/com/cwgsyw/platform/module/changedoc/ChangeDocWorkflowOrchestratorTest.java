package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.module.changedoc.dto.ChangeDocVO;
import com.cwgsyw.platform.module.notification.NotificationMapper;
import com.cwgsyw.platform.module.workflow.binding.ProcessBindingService;
import com.cwgsyw.platform.module.workflow.binding.WorkflowProcessBinding;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowRuntimeFacade;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowStartCommand;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChangeDocWorkflowOrchestratorTest {
    @Mock ChangeDocService changeDocService;
    @Mock ProcessBindingService bindingService;
    @Mock WorkflowRuntimeFacade workflowRuntimeFacade;
    @Mock NotificationMapper notificationMapper;

    @InjectMocks ChangeDocWorkflowOrchestrator orchestrator;

    @Test
    void completeSubmitStartsExactlyOneBoundChangeDocWorkflow() {
        SecurityUser user = user();
        when(changeDocService.submit(user, 41L)).thenReturn(doc("pending"));
        when(bindingService.getActiveBinding("default", "change_doc")).thenReturn(activeBinding());

        ChangeDocVO result = orchestrator.submit(user, 41L);

        assertThat(result.getStatus()).isEqualTo("pending");
        ArgumentCaptor<WorkflowStartCommand> command = ArgumentCaptor.forClass(WorkflowStartCommand.class);
        verify(workflowRuntimeFacade).startBusinessProcess(command.capture());
        assertThat(command.getValue()).extracting(
            WorkflowStartCommand::getTenantId,
            WorkflowStartCommand::getBusinessType,
            WorkflowStartCommand::getBusinessId,
            WorkflowStartCommand::getSubmitterId)
            .containsExactly("default", "change_doc", "41", 7L);
    }

    @Test
    void submitPlanStartsWorkflowWhenDocumentFirstEntersPending() {
        SecurityUser user = user();
        when(changeDocService.submitPlan(user, 42L)).thenReturn(doc("pending"));
        when(bindingService.getActiveBinding("default", "change_doc")).thenReturn(activeBinding());

        orchestrator.submitPlan(user, 42L);

        verify(workflowRuntimeFacade).startBusinessProcess(any(WorkflowStartCommand.class));
    }

    @Test
    void noBindingHistoryPreservesDirectApprovalContract() {
        SecurityUser user = user();
        when(changeDocService.submit(user, 43L)).thenReturn(doc("pending"));
        when(bindingService.getActiveBinding("default", "change_doc")).thenReturn(null);
        when(bindingService.hasBindingHistory("default", "change_doc")).thenReturn(false);

        orchestrator.submit(user, 43L);

        verify(workflowRuntimeFacade, never()).startBusinessProcess(any());
    }

    @Test
    void disabledOrDeletedBindingRejectsNewPendingSubmission() {
        SecurityUser user = user();
        when(changeDocService.submit(user, 44L)).thenReturn(doc("pending"));
        when(bindingService.getActiveBinding("default", "change_doc")).thenReturn(null);
        when(bindingService.hasBindingHistory("default", "change_doc")).thenReturn(true);

        assertThatThrownBy(() -> orchestrator.submit(user, 44L))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("未配置启用的流程绑定");
        verify(workflowRuntimeFacade, never()).startBusinessProcess(any());
    }

    @Test
    void directApprovalCannotBypassRunningUnifiedWorkflow() {
        SecurityUser user = user();
        when(workflowRuntimeFacade.hasRunningBusinessProcess("default", "change_doc", "45"))
            .thenReturn(true);

        assertThatThrownBy(() -> orchestrator.approve(user, 45L, "ok", true))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("待办中心审批");
        InOrder order = inOrder(changeDocService, workflowRuntimeFacade);
        order.verify(changeDocService).lockPendingForWorkflowDecision(user, 45L);
        order.verify(workflowRuntimeFacade).hasRunningBusinessProcess("default", "change_doc", "45");
        verify(changeDocService, never()).approve(any(), any(), any(), anyBoolean());
    }

    @Test
    void legacyApprovalLocksDocumentBeforeCheckingUnifiedWorkflow() {
        SecurityUser user = user();
        when(workflowRuntimeFacade.hasRunningBusinessProcess("default", "change_doc", "47"))
            .thenReturn(false);
        when(changeDocService.approve(user, 47L, "ok", true)).thenReturn(doc("approved"));

        orchestrator.approve(user, 47L, "ok", true);

        InOrder order = inOrder(changeDocService, workflowRuntimeFacade);
        order.verify(changeDocService).lockPendingForWorkflowDecision(user, 47L);
        order.verify(workflowRuntimeFacade).hasRunningBusinessProcess("default", "change_doc", "47");
        order.verify(changeDocService).approve(user, 47L, "ok", true);
    }

    @Test
    void remediationCleanupRemovesWorkflowBeforeBusinessDocument() {
        SecurityUser user = user();
        when(notificationMapper.selectList(any())).thenReturn(List.of());

        orchestrator.purgeRemediationTest(user, 46L, "REM_P1_073_marker");

        verify(changeDocService).validateRemediationTest(user, 46L, "REM_P1_073_marker");
        verify(workflowRuntimeFacade).purgeBusinessProcessForRemediation("default", "change_doc", "46");
        verify(changeDocService).purgeRemediationTest(user, 46L, "REM_P1_073_marker");
    }

    private WorkflowProcessBinding activeBinding() {
        WorkflowProcessBinding binding = new WorkflowProcessBinding();
        binding.setEnabled(true);
        return binding;
    }

    private ChangeDocVO doc(String status) {
        ChangeDocVO doc = new ChangeDocVO();
        doc.setStatus(status);
        return doc;
    }

    private SecurityUser user() {
        return new SecurityUser(7L, "submitter", "", "default", 1L, "platform", Set.of());
    }
}
