package com.cwgsyw.platform.module.task.automation.dto;

import java.time.LocalDateTime;

public record AutomationExecutionVO(
    Long id, Long ruleId, String sourceType, Long sourceId, String dedupeKey, String status,
    Long resultTaskId, Integer attemptCount, LocalDateTime nextAttemptAt, String lastError,
    LocalDateTime createdAt, LocalDateTime updatedAt
) {}
