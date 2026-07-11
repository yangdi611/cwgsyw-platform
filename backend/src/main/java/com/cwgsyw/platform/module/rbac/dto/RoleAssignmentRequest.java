package com.cwgsyw.platform.module.rbac.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class RoleAssignmentRequest {
    @NotNull
    private Long roleId;

    @NotNull
    @Pattern(regexp = "tenant|group", message = "scopeType must be tenant or group")
    private String scopeType;

    private Long scopeId;
    private LocalDateTime validUntil;
}
