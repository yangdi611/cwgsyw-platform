package com.cwgsyw.platform.module.approval.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ApprovalAttachmentCommentRequest(
    @NotNull Long attachmentId,
    @NotBlank String comment
) {
}
