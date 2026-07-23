package com.cwgsyw.platform.module.task.plan.dto;

import jakarta.validation.constraints.NotBlank;

public record CiScopeSelection(@NotBlank String level, @NotBlank String key) {
}
