package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.module.daily.DailyReportService;
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

    @Override
    public void notify(DelegateExecution execution) {
        String processInstId = execution.getProcessInstanceId();
        Boolean approved = (Boolean) execution.getVariable("approved");
        String status = Boolean.TRUE.equals(approved) ? "APPROVED" : "REJECTED";
        log.info("Daily report approval finished: processInst={}, status={}", processInstId, status);
        dailyReportService.updateStatusByProcessInst(processInstId, status);
    }
}
