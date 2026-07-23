package com.cwgsyw.platform.module.task.plan.dto;

import java.time.LocalDateTime;

public record TaskPlanGenerationVO(
    Long id,
    String occurrenceKey,
    LocalDateTime occurrenceAt,
    String subjectType,
    Long subjectId,
    String status,
    Long taskId,
    String errorCode,
    String errorMessage,
    Integer attemptCount,
    LocalDateTime lastAttemptAt
) {
}
