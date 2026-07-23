package com.cwgsyw.platform.module.task.plan.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.Map;

public record TaskPlanPreviewRequest(
    @NotNull Long templateVersionId,
    Long approvalSchemeVersionId,
    @NotBlank String scheduleType,
    @NotNull Map<String, Object> scheduleConfig,
    @NotBlank String generationMode,
    @NotNull Map<String, Object> assignmentRule,
    Map<String, Object> ciScopeConfig,
    LocalDate startDate,
    LocalDate endDate,
    @Min(1) @Max(50) Integer previewCount
) {
}
