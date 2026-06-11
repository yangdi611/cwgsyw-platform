package com.cwgsyw.platform.module.user.dto;

import lombok.Data;
import java.util.List;

@Data
public class UserDetailVO {
    private Long id;
    private String username;
    private String realName;
    private String email;
    private String phone;
    private Integer status;
    private Long groupId;
    private String groupName;
    private List<Long> roleIds;
}
