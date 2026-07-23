package com.cwgsyw.platform.module.task.analytics.subscription;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class TaskAnalyticsSubscriptionScheduler {
    private final TaskAnalyticsSubscriptionService service;

    @Scheduled(cron = "0 * * * * *")
    public void tick() { service.tick(); }
}
