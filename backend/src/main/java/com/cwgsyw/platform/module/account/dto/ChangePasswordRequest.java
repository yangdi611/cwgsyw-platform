package com.cwgsyw.platform.module.account.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** SPEC 8.5。 */
@Data
public class ChangePasswordRequest {
    @NotBlank
    private String currentPassword;

    @NotBlank
    private String newPassword;

    @NotBlank
    private String confirmPassword;
}
