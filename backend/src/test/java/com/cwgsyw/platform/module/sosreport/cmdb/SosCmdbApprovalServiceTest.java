package com.cwgsyw.platform.module.sosreport.cmdb;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.sosreport.SosTestSupport;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.PendingApprovalVO;
import com.cwgsyw.platform.module.sosreport.entity.SosCmdbRequest;
import com.cwgsyw.platform.module.sosreport.mapper.SosCmdbRequestMapper;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowRuntimeFacade;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowTaskCompleteCommand;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowTaskSummary;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SosCmdbApprovalServiceTest {

    @Mock WorkflowRuntimeFacade facade;
    @Mock SosCmdbRequestMapper requestMapper;
    @Mock org.springframework.context.ApplicationEventPublisher eventPublisher;

    private SosCmdbApprovalService service;
    private final SecurityUser approver = SosTestSupport.user("tenant-a", 8L, "sos_report:approve", "cmdb_instance:create");
    private SosCmdbRequest request;

    private static WorkflowTaskSummary task(String type, String businessId, boolean canApprove) {
        return WorkflowTaskSummary.builder()
            .taskId("task-" + businessId).taskName("审批").businessType(type).businessId(businessId)
            .canApprove(canApprove).submitterName("张三").recognized(true).build();
    }

    @BeforeEach
    void setUp() {
        SosTestSupport.initTables();
        service = new SosCmdbApprovalService(facade, requestMapper, eventPublisher);
        request = new SosCmdbRequest();
        request.setId(9L);
        request.setTenantId("tenant-a");
        request.setReportId(5L);
        request.setAction(SosCmdbRequest.ACTION_CREATE);
        request.setInstanceName("web-01");
        request.setModelCode("host");
        request.setProposedFields(Map.of("sn", "SN-1"));
        request.setStatus(SosCmdbRequest.STATUS_PENDING);
        when(requestMapper.selectOne(any())).thenReturn(request);
        when(requestMapper.selectList(any())).thenReturn(List.of(request));
        when(facade.listMyTasks(approver)).thenReturn(List.of(task("sos_cmdb_request", "9", true)));
    }

    @Test
    void listsOnlyApprovableTasksOfThisBusinessType() {
        when(facade.listMyTasks(approver)).thenReturn(List.of(
            task("sos_cmdb_request", "9", true),
            task("wiki_page", "1", true),
            task("sos_cmdb_request", "10", false)));

        List<PendingApprovalVO> pending = service.pending(approver);

        assertEquals(1, pending.size());
        assertEquals(9L, pending.get(0).getRequestId());
        assertEquals(5L, pending.get(0).getReportId());
        assertEquals("SN-1", pending.get(0).getProposedFields().get("sn"), "审批人要能看到将写入的内容");
        assertEquals("张三", pending.get(0).getSubmitterName());
    }

    @Test
    void noTasksMeansNoQuery() {
        when(facade.listMyTasks(approver)).thenReturn(List.of());

        assertTrue(service.pending(approver).isEmpty());
        verify(requestMapper, never()).selectList(any());
    }

    @Test
    void approvalCompletesTheCandidateTask() {
        service.decide(approver, 9L, true, " 同意 ");

        ArgumentCaptor<WorkflowTaskCompleteCommand> command = ArgumentCaptor.forClass(WorkflowTaskCompleteCommand.class);
        verify(facade).completeTask(command.capture());
        assertEquals("task-9", command.getValue().getTaskId());
        assertEquals("tenant-a", command.getValue().getTenantId());
        assertEquals(8L, command.getValue().getOperatorId());
        assertTrue(command.getValue().isApproved());
        assertEquals("同意", command.getValue().getComment());
        verify(eventPublisher).publishEvent(new SosApprovalTasksChangedEvent("tenant-a", 9L));
    }

    @Test
    void rejectionRequiresAReason() {
        assertEquals("SOS_CMDB_REASON_REQUIRED", assertThrows(BusinessException.class,
            () -> service.decide(approver, 9L, false, "  ")).getErrorCode());
        verify(facade, never()).completeTask(any());

        service.decide(approver, 9L, false, "序列号不对");
        ArgumentCaptor<WorkflowTaskCompleteCommand> command = ArgumentCaptor.forClass(WorkflowTaskCompleteCommand.class);
        verify(facade).completeTask(command.capture());
        assertFalse(command.getValue().isApproved());
    }

    @Test
    void decisionIsRequiredAndCommentBounded() {
        assertEquals("SOS_CMDB_DECISION_REQUIRED", assertThrows(BusinessException.class,
            () -> service.decide(approver, 9L, null, "x")).getErrorCode());
        assertEquals("SOS_CMDB_REASON_TOO_LONG", assertThrows(BusinessException.class,
            () -> service.decide(approver, 9L, true, "x".repeat(501))).getErrorCode());
    }

    @Test
    void userWithoutTaskCannotDecide() {
        SecurityUser other = SosTestSupport.user("tenant-a", 99L, "sos_report:approve");
        when(facade.listMyTasks(other)).thenReturn(List.of());

        BusinessException exception = assertThrows(BusinessException.class, () -> service.decide(other, 9L, true, null));

        assertEquals("SOS_CMDB_NOT_APPROVER", exception.getErrorCode());
        assertEquals(403, exception.getHttpStatus());
        verify(facade, never()).completeTask(any());
    }

    @Test
    void candidateWithoutBusinessPermissionCannotDecide() {
        when(facade.listMyTasks(approver)).thenReturn(List.of(task("sos_cmdb_request", "9", false)));

        assertEquals("SOS_CMDB_NOT_APPROVER", assertThrows(BusinessException.class,
            () -> service.decide(approver, 9L, true, null)).getErrorCode());
    }

    @Test
    void decidedRequestCannotBeDecidedAgain() {
        request.setStatus(SosCmdbRequest.STATUS_APPLIED);

        assertEquals("SOS_CMDB_ALREADY_DECIDED", assertThrows(BusinessException.class,
            () -> service.decide(approver, 9L, true, null)).getErrorCode());
        verify(facade, never()).completeTask(any());
    }

    @Test
    void requestOutsideTenantIsNotFound() {
        when(requestMapper.selectOne(any())).thenReturn(null);

        assertEquals("SOS_CMDB_REQUEST_NOT_FOUND", assertThrows(BusinessException.class,
            () -> service.decide(approver, 9L, true, null)).getErrorCode());
    }
}
