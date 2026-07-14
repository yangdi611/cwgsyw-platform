package com.cwgsyw.platform.module.org.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_user_group_membership")
public class UserGroupMembership extends BaseEntity {
    private Long userId;
    private Long groupId;
    private String membershipRole;
    private Boolean isPrimary;
    private String originType;
    private String originKey;
    private String migrationRunId;
}
