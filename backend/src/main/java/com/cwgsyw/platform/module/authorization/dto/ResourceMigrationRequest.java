package com.cwgsyw.platform.module.authorization.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ResourceMigrationRequest {
    @NotNull
    private Long systemOwnerUserId;
    @NotNull
    private Long systemOwnerGroupId;
}
