package com.cwgsyw.platform.module.task.plan.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.Map;

public record UpsertTaskPlanRequest(
    @NotBlank @Size(max = 255) String name,
    @Size(max = 5000) String description,
    @NotNull Long templateVersionId,
    Long approvalSchemeVersionId,
    @NotBlank String scheduleType,
    @NotNull Map<String, Object> scheduleConfig,
    @NotBlank String generationMode,
    @NotNull Map<String, Object> assignmentRule,
    Map<String, Object> ciScopeConfig,
    Map<String, Object> reminderConfig,
    Map<String, Object> escalationConfig,
    @Min(0) @Max(365) Integer generateAheadDays,
    LocalDate startDate,
    LocalDate endDate
) {
}
