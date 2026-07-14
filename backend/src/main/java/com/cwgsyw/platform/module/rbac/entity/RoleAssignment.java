package com.cwgsyw.platform.module.rbac.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_role_assignment")
public class RoleAssignment extends BaseEntity {
    private Long userId;
    private Long roleId;
    private String scopeType;
    private Long scopeId;
    private LocalDateTime validFrom;
    private LocalDateTime validUntil;
    private String originType;
    private String originKey;
    private String migrationRunId;
}
