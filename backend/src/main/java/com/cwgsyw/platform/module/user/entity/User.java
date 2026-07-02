package com.cwgsyw.platform.module.user.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_user")
public class User extends BaseEntity {
    private Long groupId;
    private String username;
    @JsonIgnore
    private String password;
    private String realName;
    private String email;
    private String phone;
    private String avatarUrl;
    private Integer status;

    // 账号安全增强字段（V64），camelCase 直出，DB 列为 snake_case
    private Boolean mustChangePassword;
    private Boolean profileCompleted;
    private LocalDateTime passwordChangedAt;
    private LocalDateTime lastLoginAt;
    private String lastLoginIp;
}
