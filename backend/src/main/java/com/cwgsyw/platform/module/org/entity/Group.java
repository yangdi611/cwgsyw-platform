package com.cwgsyw.platform.module.org.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_group")
public class Group extends BaseEntity {
    private String name;
    private String description;
    private Long leaderId;
}
