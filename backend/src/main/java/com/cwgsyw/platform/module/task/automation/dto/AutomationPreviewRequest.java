package com.cwgsyw.platform.module.task.automation.dto;

import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record AutomationPreviewRequest(
    @NotNull Long sourceTaskId,
    Long sourceSubmissionId,
    Map<String, Object> attributes
) {
    public AutomationPreviewRequest(Long sourceTaskId, Long sourceSubmissionId) {
        this(sourceTaskId, sourceSubmissionId, Map.of());
    }
}
