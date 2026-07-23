package com.cwgsyw.platform.module.approval.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateApprovalSchemeRequest(
    @NotBlank @Size(max = 255) String name,
    @Size(max = 2000) String description,
    @NotBlank String scopeType,
    Long ownerGroupId
) {
}
