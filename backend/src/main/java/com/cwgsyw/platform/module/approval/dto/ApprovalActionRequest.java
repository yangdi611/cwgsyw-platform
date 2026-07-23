package com.cwgsyw.platform.module.approval.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record ApprovalActionRequest(
    @NotBlank String action,
    String comment,
    List<@Valid ApprovalFieldCommentRequest> fieldComments,
    List<@Valid ApprovalAttachmentCommentRequest> attachmentComments
) {
}
