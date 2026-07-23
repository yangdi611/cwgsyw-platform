package com.cwgsyw.platform.module.task.runtime.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.Map;

public record CreateOneOffTaskRequest(
    @NotNull Long templateVersionId,
    Long approvalSchemeVersionId,
    @NotBlank String title,
    String description,
    @NotNull LocalDateTime plannedStartAt,
    @NotNull LocalDateTime dueAt,
    String priority,
    @NotNull Long assigneeId,
    Long groupId,
    Map<String, Object> ciScopeConfig
) {
}
