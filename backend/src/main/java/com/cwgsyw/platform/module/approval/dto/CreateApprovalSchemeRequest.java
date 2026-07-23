package com.cwgsyw.platform.module.approval.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateApprovalSchemeRequest(
    @NotBlank @Pattern(regexp = "[a-z][a-z0-9_]{1,99}") String code,
    @NotBlank @Size(max = 255) String name,
    @Size(max = 2000) String description,
    @NotBlank String scopeType,
    Long ownerGroupId,
    @NotNull ApprovalDefinitionRequest definition
) {
}
