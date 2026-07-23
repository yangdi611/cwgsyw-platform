package com.cwgsyw.platform.module.task.runtime.dto;

import jakarta.validation.constraints.NotBlank;

public record CloseExceptionRequest(@NotBlank String reason) {
}
