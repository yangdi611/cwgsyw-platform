package com.cwgsyw.platform.module.task.plan.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

public record TaskPlanDetailVO(
    Long id,
    String name,
    String description,
    Long templateVersionId,
    String templateName,
    Long approvalSchemeVersionId,
    String scheduleType,
    Map<String, Object> scheduleConfig,
    String generationMode,
    Map<String, Object> assignmentRule,
    Map<String, Object> ciScopeConfig,
    Map<String, Object> reminderConfig,
    Map<String, Object> escalationConfig,
    Integer generateAheadDays,
    LocalDate startDate,
    LocalDate endDate,
    String status,
    LocalDateTime nextGenerateAt,
    LocalDateTime lastGeneratedAt,
    Integer lockVersion,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
