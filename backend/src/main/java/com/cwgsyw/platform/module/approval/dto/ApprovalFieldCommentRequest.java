package com.cwgsyw.platform.module.approval.dto;

import jakarta.validation.constraints.NotBlank;

public record ApprovalFieldCommentRequest(
    @NotBlank String fieldKey,
    @NotBlank String severity,
    @NotBlank String comment
) {
}
