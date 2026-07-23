package com.cwgsyw.platform.module.approval.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateApprovalSchemeVersionRequest(
    @NotNull ApprovalDefinitionRequest definition
) {
}
