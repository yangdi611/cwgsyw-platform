package com.cwgsyw.platform.module.authorization.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class CleanupMigrationExceptionRequest {
    @NotBlank(message = "请输入 CLEANUP 确认")
    @Pattern(regexp = "CLEANUP", message = "请输入 CLEANUP 确认")
    private String confirmation;
}
