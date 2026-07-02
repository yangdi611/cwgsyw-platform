package com.cwgsyw.platform.module.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** 管理员重置密码请求（SPEC 8.7）。不需要当前密码，仍执行密码策略、用户名包含、历史校验。 */
@Data
public class ResetPasswordRequest {
    @NotBlank
    private String newPassword;

    @NotBlank
    private String confirmPassword;
}
