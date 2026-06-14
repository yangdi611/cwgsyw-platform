package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ci_attribute_group")
public class CiAttributeGroup extends BaseEntity {
    private String modelId;
    @TableField("group_id")
    private String code;
    private String name;
    private Integer sortOrder;
}
