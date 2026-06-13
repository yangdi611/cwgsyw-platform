package com.cwgsyw.platform.module.user.dto;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.util.List;

@Data
public class CreateUserRequest {
    @NotBlank private String username;
    @NotBlank @Size(min = 6) private String password;
    private String realName;
    private String email;
    @Pattern(regexp = "^$|^1[3-9]\\d{9}$")
    private String phone;
    private Long groupId;
    private List<Long> roleIds;
}
