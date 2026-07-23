package com.cwgsyw.platform.module.task.automation;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class TaskAutomationEventListener {
    private final TaskAutomationService service;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(TaskLifecycleEvent event) { service.onEvent(event); }
}
