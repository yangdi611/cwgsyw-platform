package com.cwgsyw.platform.module.user.dto;

import lombok.Data;
import java.util.List;

@Data
public class UserDetailVO {
    private Long id;
    private String username;
    private String realName;
    private String email;
    private Integer status;
    private Long groupId;
    private List<Long> roleIds;
}
