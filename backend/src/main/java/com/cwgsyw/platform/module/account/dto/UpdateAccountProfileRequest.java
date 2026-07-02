package com.cwgsyw.platform.module.account.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** SPEC 8.4。不含 realName — 普通用户第一阶段不能自助修改真实姓名。 */
@Data
public class UpdateAccountProfileRequest {
    @Email
    @Size(max = 128)
    private String email;

    @Size(max = 32)
    private String phone;

    @Size(max = 512)
    private String avatarUrl;
}
