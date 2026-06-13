package com.cwgsyw.platform.module.user.dto;

import lombok.Data;
import java.util.List;

@Data
public class UpdateUserRequest {
    private String realName;
    private String email;
    private String password;
    private Long groupId;
    private Integer status;
    private List<Long> roleIds;
}
