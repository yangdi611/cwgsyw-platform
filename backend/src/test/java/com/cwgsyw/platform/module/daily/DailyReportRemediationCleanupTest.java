package com.cwgsyw.platform.module.daily;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import com.cwgsyw.platform.module.notification.NotificationMapper;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.notification.entity.NotificationMessage;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.workflow.event.WorkflowBusinessInstance;
import com.cwgsyw.platform.module.workflow.event.WorkflowBusinessInstanceMapper;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowRuntimeFacade;
import org.flowable.engine.HistoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.runtime.ProcessInstance;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DailyReportRemediationCleanupTest {
    @Mock DailyReportMapper reportMapper;
    @Mock WorkflowRuntimeFacade workflowRuntimeFacade;
    @Mock UserMapper userMapper;
    @Mock GroupMapper groupMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock CiInstanceMapper ciInstanceMapper;
    @Mock CiModelMapper ciModelMapper;
    @Mock NotificationService notificationService;
    @Mock NotificationMapper notificationMapper;
    @Mock WorkflowBusinessInstanceMapper workflowBusinessInstanceMapper;
    @Mock(answer = Answers.RETURNS_DEEP_STUBS) RuntimeService runtimeService;
    @Mock HistoryService historyService;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;
    @Mock ProcessInstance processInstance;

    @InjectMocks DailyReportService service;

    @Test
    void purgeRemediationReport_rejectsNonPlatformUserWithoutSideEffects() {
        assertThatThrownBy(() -> service.purgeRemediationReport(8L, "default", 1L, "group", "REM_P1_026_x"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("仅平台管理员可以清理整改测试日报");

        verify(reportMapper, never()).selectById(any());
    }

    @Test
    void purgeRemediationReport_rejectsReportWithoutMatchingRunId() {
        DailyReport report = report("normal content");
        when(reportMapper.selectById(8L)).thenReturn(report);

        assertThatThrownBy(() -> service.purgeRemediationReport(8L, "default", 1L, "platform", "REM_P1_026_x"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("仅允许清理内容带 remediationRunId 的测试日报");

        verify(reportMapper, never()).deleteById(any(Long.class));
    }

    @Test
    void purgeRemediationReport_cleansOnlyMatchingReportDependencies() {
        String runId = "REM_P1_026_x";
        DailyReport report = report("test " + runId);
        report.setProcessInstId("pi-1");
        NotificationMessage notification = new NotificationMessage();
        notification.setId(5L);
        WorkflowBusinessInstance businessInstance = new WorkflowBusinessInstance();
        businessInstance.setId(6L);
        when(reportMapper.selectById(8L)).thenReturn(report);
        when(runtimeService.createProcessInstanceQuery().processInstanceId("pi-1").singleResult())
            .thenReturn(processInstance);
        when(notificationMapper.selectList(any())).thenReturn(List.of(notification));
        when(workflowBusinessInstanceMapper.selectList(any())).thenReturn(List.of(businessInstance));

        service.purgeRemediationReport(8L, "default", 1L, "platform", runId);

        verify(runtimeService).deleteProcessInstance("pi-1", "remediation test cleanup");
        verify(historyService).deleteHistoricProcessInstance("pi-1");
        verify(notificationMapper).deleteById(5L);
        verify(workflowBusinessInstanceMapper).deleteById(6L);
        verify(reportMapper).deleteById(8L);
        verify(auditLogMapper).insert(any(AuditLog.class));
    }

    @Test
    void purgeRemediationReport_cleansApprovedLegacyFqaMarkerWithMatchingTimestamp() {
        DailyReport report = report("FQA_MEMBER_DAILY_20260716_2300 completed");
        report.setStatus("APPROVED");
        when(reportMapper.selectById(8L)).thenReturn(report);
        when(notificationMapper.selectList(any())).thenReturn(List.of());
        when(workflowBusinessInstanceMapper.selectList(any())).thenReturn(List.of());

        service.purgeRemediationReport(8L, "default", 1L, "platform", "FQA_20260716_2300_lintfix");

        verify(reportMapper).deleteById(8L);
        verify(auditLogMapper).insert(any(AuditLog.class));
    }

    @Test
    void purgeRemediationReport_rejectsLegacyFqaMarkerWithDifferentTimestamp() {
        DailyReport report = report("FQA_MEMBER_DAILY_20260716_2300 completed");
        when(reportMapper.selectById(8L)).thenReturn(report);

        assertThatThrownBy(() -> service.purgeRemediationReport(
            8L, "default", 1L, "platform", "FQA_20260717_0000_lintfix"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("仅允许清理内容带 remediationRunId 的测试日报");

        verify(reportMapper, never()).deleteById(any(Long.class));
    }

    private DailyReport report(String completedItems) {
        DailyReport report = new DailyReport();
        report.setTenantId("default");
        report.setCompletedItems(completedItems);
        report.setTomorrowPlan("plan");
        report.setIsDeleted(false);
        return report;
    }
}
