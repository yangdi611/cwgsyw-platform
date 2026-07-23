package com.cwgsyw.platform.module.task.automation;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class TaskAutomationScheduler {
    private final TaskAutomationService service;

    @Scheduled(cron = "0 * * * * *")
    public void tick() {
        try {
            service.retryDue();
        } catch (Exception exception) {
            log.error("Unified task automation retry failed", exception);
        }
    }
}
