package com.cwgsyw.platform.module.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 密码历史记录（V64）。用于新密码不能与最近 N 次密码重复、不能等于初始密码的校验。
 * 不保存明文密码，只保存 BCrypt hash。
 */
@Data
@TableName("sys_user_password_history")
public class UserPasswordHistory {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long userId;
    private String passwordHash;
    private String source;  // CREATE_USER | RESET_PASSWORD | CHANGE_PASSWORD

    @TableField(fill = com.baomidou.mybatisplus.annotation.FieldFill.INSERT)
    private LocalDateTime createdAt;
    private Long createdBy;
}
