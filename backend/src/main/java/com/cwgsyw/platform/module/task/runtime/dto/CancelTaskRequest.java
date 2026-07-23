package com.cwgsyw.platform.module.task.runtime.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CancelTaskRequest(@NotBlank @Size(max = 2000) String reason) {
}
