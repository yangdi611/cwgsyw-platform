package com.cwgsyw.platform.module.task.plan.scheduler;

import com.cwgsyw.platform.module.task.plan.service.TaskPlanGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class TaskPlanScheduler {
    private final TaskPlanGenerator generator;

    @Scheduled(cron = "0 * * * * *")
    public void tick() {
        try {
            int generated = generator.generateDuePlans(LocalDateTime.now(), 100);
            if (generated > 0) log.info("Unified task scheduler generated {} tasks", generated);
        } catch (Exception exception) {
            log.error("Unified task scheduler failed", exception);
        }
    }
}
