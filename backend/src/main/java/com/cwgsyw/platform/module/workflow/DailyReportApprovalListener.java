package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.module.daily.DailyReportService;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import com.cwgsyw.platform.module.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.ExecutionListener;
import org.springframework.stereotype.Component;

@Component("dailyReportApprovalListener")
@RequiredArgsConstructor
@Slf4j
public class DailyReportApprovalListener implements ExecutionListener {
    private final DailyReportService dailyReportService;
    private final NotificationService notificationService;

    @Override
    public void notify(DelegateExecution execution) {
        String processInstId = execution.getProcessInstanceId();
        Boolean approved = (Boolean) execution.getVariable("approved");
        String status = Boolean.TRUE.equals(approved) ? "APPROVED" : "REJECTED";
        log.info("Daily report approval finished: processInst={}, status={}", processInstId, status);
        DailyReport report = dailyReportService.updateStatusByProcessInstAndReturn(processInstId, status);
        if (report != null) {
            String title = "APPROVED".equals(status) ? "日报审批通过" : "日报被拒绝";
            String content = "APPROVED".equals(status)
                ? "您 " + report.getReportDate() + " 的工作日报已审批通过。"
                : "您 " + report.getReportDate() + " 的工作日报已被拒绝，请修改后重新提交。";
            notificationService.notify(report.getTenantId(), report.getReporterId(),
                title, content, "daily_report_approval", "daily_report", report.getId());
        }
    }
}
