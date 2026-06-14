package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ci_model")
public class CiModel extends BaseEntity {
    private String name;
    private String displayName;
    private Long groupId;
    private Boolean isBuiltIn;
    private String color;
    @TableField("enable_2d_view")
    private Boolean enable2dView;
    
    public String getModelId() {
        return this.name;
    }
}
