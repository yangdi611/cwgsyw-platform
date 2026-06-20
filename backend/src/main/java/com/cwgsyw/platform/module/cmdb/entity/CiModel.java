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
    @TableField("group_code")
    private String groupCode;
    private Boolean isBuiltIn;
    private String color;
    @TableField("enable_2d_view")
    private Boolean enable2dView;

    /**
     * Canonical model code (AD-4): the model's {@code name} column carries the
     * model-code semantics. {@code getModelId()} alias was removed; DTOs keep a
     * {@code modelId} alias for the compatibility window.
     */
    public String getModelCode() {
        return this.name;
    }
}
