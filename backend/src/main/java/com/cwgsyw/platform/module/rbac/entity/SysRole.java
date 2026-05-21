package com.cwgsyw.platform.module.rbac.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_role")
public class SysRole extends BaseEntity {
    private String name;
    private String code;
    private String scope;
    private String description;
}
