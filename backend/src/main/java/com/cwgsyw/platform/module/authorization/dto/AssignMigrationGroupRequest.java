package com.cwgsyw.platform.module.authorization.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AssignMigrationGroupRequest {
    @NotNull
    private Long groupId;
}
