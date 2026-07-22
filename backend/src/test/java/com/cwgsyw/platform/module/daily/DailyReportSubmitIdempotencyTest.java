package com.cwgsyw.platform.module.daily;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowRuntimeFacade;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DailyReportSubmitIdempotencyTest {
    @Mock DailyReportMapper reportMapper;
    @Mock WorkflowRuntimeFacade workflowRuntimeFacade;
    @Mock UserMapper userMapper;
    @Mock GroupMapper groupMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock CiInstanceMapper ciInstanceMapper;
    @Mock CiModelMapper ciModelMapper;
    @Mock NotificationService notificationService;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;

    @InjectMocks DailyReportService service;

    @Test
    void submitRejectsAlreadySubmittedLockedReportBeforeStartingWorkflow() {
        DailyReport report = new DailyReport();
        report.setId(42L);
        report.setReporterId(7L);
        report.setStatus("SUBMITTED");
        report.setIsDeleted(false);
        when(reportMapper.findActiveByIdForUpdate(42L)).thenReturn(report);

        assertThatIllegalArgumentException().isThrownBy(() -> service.submit(42L, 7L))
            .withMessage("只能提交草稿或被拒绝的日报");

        verify(workflowRuntimeFacade, never()).startBusinessProcess(org.mockito.ArgumentMatchers.any());
    }
}
