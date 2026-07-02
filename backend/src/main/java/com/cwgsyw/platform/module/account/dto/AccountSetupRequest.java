package com.cwgsyw.platform.module.account.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * SPEC 8.6。第一阶段页面始终一次性提交密码+资料；
 * currentPassword/newPassword/confirmPassword 校验放在 Service（用户若已不需要改密可传空）。
 */
@Data
public class AccountSetupRequest {
    private String currentPassword;
    private String newPassword;
    private String confirmPassword;

    @NotBlank
    @Email
    @Size(max = 128)
    private String email;

    @NotBlank
    @Size(max = 32)
    private String phone;

    @Size(max = 512)
    private String avatarUrl;
}
