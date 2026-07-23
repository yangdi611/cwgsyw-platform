package com.cwgsyw.platform.module.task.automation;

import com.cwgsyw.platform.module.task.automation.entity.TaskAutomationExecution;
import com.cwgsyw.platform.module.task.automation.mapper.TaskAutomationExecutionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class TaskAutomationFailureRecorder {
    private static final int MAX_ATTEMPTS = 3;

    private final TaskAutomationExecutionMapper executionMapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void record(TaskAutomationExecution execution, Exception exception) {
        TaskAutomationExecution persisted = executionMapper.selectById(execution.getId());
        if (persisted == null) return;
        int attempts = (persisted.getAttemptCount() == null ? 0 : persisted.getAttemptCount()) + 1;
        persisted.setAttemptCount(attempts);
        persisted.setStatus(attempts >= MAX_ATTEMPTS ? "dead" : "failed");
        persisted.setLastError(errorMessage(exception));
        persisted.setNextAttemptAt(attempts >= MAX_ATTEMPTS ? null : LocalDateTime.now().plusMinutes(5));
        persisted.setUpdatedAt(LocalDateTime.now());
        executionMapper.updateById(persisted);
    }

    private String errorMessage(Exception exception) {
        String message = exception.getMessage();
        return message == null || message.isBlank() ? exception.getClass().getSimpleName() : message;
    }
}
