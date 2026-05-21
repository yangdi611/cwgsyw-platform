package com.cwgsyw.platform.module.rbac.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("sys_permission")
public class SysPermission {
    private Long id;
    private Long resourceId;
    private String action;
    private String code;
    private String name;
}
