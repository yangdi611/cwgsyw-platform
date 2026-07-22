package com.cwgsyw.platform.module.daily;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowRuntimeFacade;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DailyReportHistoricalGroupTest {
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
    void approvedReport_displaysArchivedGroupThroughTenantBoundLookup() {
        DailyReport report = new DailyReport();
        report.setId(20L);
        report.setTenantId("default");
        report.setGroupId(15L);
        report.setReporterId(8L);
        report.setStatus("APPROVED");
        report.setIsDeleted(false);
        Group archived = new Group();
        archived.setId(15L);
        archived.setName("历史日报组");
        archived.setIsDeleted(true);
        when(reportMapper.selectById(20L)).thenReturn(report);
        when(groupMapper.findByTenantAndIdIncludingDeleted("default", 15L)).thenReturn(archived);

        var result = service.getById(20L, "default");

        assertThat(result.getGroupName()).isEqualTo("历史日报组");
        assertThat(result.getGroupArchived()).isTrue();
        verify(groupMapper, never()).selectById(15L);
    }

    @Test
    void rejectedReport_keepsActiveOnlyLookupBecauseItCanBeResubmitted() {
        DailyReport report = new DailyReport();
        report.setId(21L);
        report.setTenantId("default");
        report.setGroupId(15L);
        report.setReporterId(8L);
        report.setStatus("REJECTED");
        report.setIsDeleted(false);
        when(reportMapper.selectById(21L)).thenReturn(report);

        var result = service.getById(21L, "default");

        assertThat(result.getGroupArchived()).isNull();
        verify(groupMapper).selectById(15L);
        verify(groupMapper, never()).findByTenantAndIdIncludingDeleted("default", 15L);
    }

    @Test
    void listMyReports_rejectsInvalidMonthBeforeQuery() {
        assertThatIllegalArgumentException().isThrownBy(() -> service.listMyReports(8L, "2026-99", 1, 31))
            .withMessage("月份格式必须为 yyyy-MM");

        verify(reportMapper, never()).selectPage(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void listGroupReports_rejectsBlankMonthBeforeQuery() {
        assertThatIllegalArgumentException().isThrownBy(() -> service.listGroupReports(null, null, " ", 1, 200))
            .withMessage("月份格式必须为 yyyy-MM");

        verify(reportMapper, never()).selectPage(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }
}
