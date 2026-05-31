package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.module.daily.DailyReportService;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import com.cwgsyw.platform.module.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.event.FlowableEngineEventType;
import org.flowable.common.engine.api.delegate.event.FlowableEvent;
import org.flowable.common.engine.api.delegate.event.FlowableEventListener;
import org.flowable.engine.HistoryService;
import org.flowable.engine.history.HistoricVariableInstance;
import org.springframework.stereotype.Component;

/**
 * Global workflow event listener — catches process COMPLETED events for ALL
 * process definitions. This is the bridge between the visual process designer
 * and business logic.
 *
 * When a process ends, this listener:
 * 1. Reads the businessKey (e.g. "dailyReport:42")
 * 2. Reads process variables from history to determine outcome
 * 3. Updates the business object status
 *
 * No BPMN-level execution listener needed — any process designed in the
 * visual editor automatically gets completion handling.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WorkflowGlobalListener implements FlowableEventListener {

    private final DailyReportService dailyReportService;
    private final NotificationService notificationService;
    private final HistoryService historyService;

    @Override
    public void onEvent(FlowableEvent event) {
        if (event.getType() != FlowableEngineEventType.PROCESS_COMPLETED) return;

        String processInstanceId = event.getProcessInstanceId();
        String businessKey = event.getBusinessKey();
        if (businessKey == null || businessKey.isEmpty()) return;

        log.info("Process completed: instance={}, businessKey={}", processInstanceId, businessKey);

        // Parse "dailyReport:42" → type=dailyReport, id=42
        String[] parts = businessKey.split(":", 2);
        if (parts.length != 2) return;
        String businessType = parts[0];

        switch (businessType) {
            case "dailyReport" -> handleDailyReport(processInstanceId);
            case "changeDoc"  -> log.info("Change doc completed: instance={}", processInstanceId);
            default -> log.debug("Unknown business type: {}", businessType);
        }
    }

    private void handleDailyReport(String processInstanceId) {
        // Read the 'approved' variable from history
        HistoricVariableInstance var = historyService.createHistoricVariableInstanceQuery()
            .processInstanceId(processInstanceId)
            .variableName("approved")
            .singleResult();
        boolean approved = var != null && Boolean.TRUE.equals(var.getValue());
        String status = approved ? "APPROVED" : "REJECTED";

        DailyReport report = dailyReportService.updateStatusByProcessInstAndReturn(
            processInstanceId, status);
        if (report != null) {
            String title = approved ? "日报审批通过" : "日报被拒绝";
            String content = approved
                ? "您 " + report.getReportDate() + " 的工作日报已审批通过。"
                : "您 " + report.getReportDate() + " 的工作日报已被拒绝，请修改后重新提交。";
            notificationService.notify(report.getTenantId(), report.getReporterId(),
                title, content, "daily_report_approval", "daily_report", report.getId());
        }
    }

    @Override public boolean isFailOnException() { return false; }
    @Override public boolean isFireOnTransactionLifecycleEvent() { return false; }
    @Override public String getOnTransaction() { return null; }
}
