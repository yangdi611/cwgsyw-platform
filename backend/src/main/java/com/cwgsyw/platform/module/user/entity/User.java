package com.cwgsyw.platform.module.user.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;
import lombok.EqualsAndHashCode;

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
}
