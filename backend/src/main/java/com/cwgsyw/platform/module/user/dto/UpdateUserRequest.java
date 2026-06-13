package com.cwgsyw.platform.module.user.dto;

import jakarta.validation.constraints.Pattern;
import lombok.Data;
import java.util.List;

@Data
public class UpdateUserRequest {
    private String realName;
    private String email;
    @Pattern(regexp = "^$|^1[3-9]\\d{9}$")
    private String phone;
    private String password;
    private Long groupId;
    private Integer status;
    private List<Long> roleIds;
}
