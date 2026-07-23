package com.cwgsyw.platform.module.task.plan.dto;

import java.time.LocalDateTime;

public record TaskPlanSummaryVO(
    Long id,
    String name,
    String description,
    Long templateVersionId,
    String templateName,
    String scheduleType,
    String generationMode,
    String status,
    LocalDateTime nextGenerateAt,
    LocalDateTime lastGeneratedAt,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
