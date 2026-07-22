package com.cwgsyw.platform.module.workflow.adapter;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.daily.DailyReportMapper;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.wiki.WikiPageMapper;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import com.cwgsyw.platform.module.workflow.event.WorkflowCompletedEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowAdapterAuditRemarkTest {
    @Mock DailyReportMapper reportMapper;
    @Mock WikiPageMapper pageMapper;
    @Mock UserMapper userMapper;
    @Mock NotificationService notificationService;
    @Mock AuditLogMapper auditLogMapper;

    @Test
    void dailyCompletionBoundsAuditRemarkWithoutChangingBusinessComment() {
        DailyReport report = new DailyReport();
        report.setId(41L);
        report.setTenantId("default");
        report.setReporterId(7L);
        report.setReportDate(LocalDate.of(2026, 7, 20));
        report.setStatus("SUBMITTED");
        when(reportMapper.selectById(41L)).thenReturn(report);
        when(reportMapper.updateById(any(DailyReport.class))).thenReturn(1);
        when(auditLogMapper.insert(any(AuditLog.class))).thenReturn(1);
        String comment = "日报驳回🙂".repeat(900);
        DailyReportWorkflowAdapter adapter = new DailyReportWorkflowAdapter(
            reportMapper, userMapper, notificationService, auditLogMapper);

        adapter.onWorkflowCompleted(event("daily_report", "41", false, comment));

        assertThat(report.getStatus()).isEqualTo("REJECTED");
        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(audit.capture());
        assertThat(audit.getValue().getRemark()).startsWith("流程结束回写: SUBMITTED -> REJECTED (").endsWith("...");
        assertThat(audit.getValue().getRemark().codePointCount(0, audit.getValue().getRemark().length())).isEqualTo(512);
        verify(notificationService).notify(eq("default"), eq(7L), eq("日报被拒绝"), any(),
            eq("daily_report_approval"), eq("daily_report"), eq(41L));
        assertThat(comment.codePointCount(0, comment.length())).isGreaterThan(512);
    }

    @Test
    void wikiCompletionBoundsAuditRemarkWithoutChangingNotificationComment() {
        WikiPage page = new WikiPage();
        page.setId(51L);
        page.setTenantId("default");
        page.setTitle("长意见页面");
        page.setStatus("review");
        page.setCreatedBy(8L);
        when(pageMapper.selectById(51L)).thenReturn(page);
        when(pageMapper.updateById(any(WikiPage.class))).thenReturn(1);
        when(auditLogMapper.insert(any(AuditLog.class))).thenReturn(1);
        String comment = "Wiki驳回🙂".repeat(900);
        WikiWorkflowAdapter adapter = new WikiWorkflowAdapter(
            pageMapper, userMapper, notificationService, auditLogMapper);

        adapter.onWorkflowCompleted(event("wiki_page", "51", false, comment));

        assertThat(page.getStatus()).isEqualTo("draft");
        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(audit.capture());
        assertThat(audit.getValue().getRemark()).endsWith("...");
        assertThat(audit.getValue().getRemark().codePointCount(0, audit.getValue().getRemark().length())).isEqualTo(512);
        verify(notificationService).notify(eq("default"), eq(8L), eq("Wiki 审批被拒绝"),
            eq("《长意见页面》审批被拒绝：" + comment), eq("wiki_publish_approval"), eq("wiki_page"), eq(51L));
    }

    private WorkflowCompletedEvent event(String businessType, String businessId,
                                         boolean approved, String comment) {
        return WorkflowCompletedEvent.builder()
            .tenantId("default")
            .businessType(businessType)
            .businessId(businessId)
            .approved(approved)
            .comment(comment)
            .approverId(1L)
            .build();
    }
}
