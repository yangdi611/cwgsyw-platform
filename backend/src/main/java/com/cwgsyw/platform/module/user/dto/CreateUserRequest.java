package com.cwgsyw.platform.module.user.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.util.List;

@Data
public class CreateUserRequest {
    @NotBlank private String username;
    // 密码长度/复杂度不再用 @Size 校验，改由 PasswordPolicyService 强制（SPEC 11.4）
    @NotBlank private String password;
    @JsonAlias("real_name") private String realName;
    private String email;
    // 国际化宽松格式，服务层标准化后校验（SPEC 12.1）
    @Pattern(regexp = "^$|^\\+?[0-9 ()\\-]{6,32}$", message = "手机号格式不正确")
    private String phone;
    @JsonAlias("group_id")  private Long groupId;
    @JsonAlias("role_ids")  private List<Long> roleIds;
}
