package com.cwgsyw.platform.module.task.runtime.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record SaveTaskDraftRequest(
    @NotNull @Min(0) Integer revision,
    @NotNull Map<String, Object> formData
) {
}
