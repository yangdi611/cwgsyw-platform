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
    /** Canonical model code, e.g. "host", "app" — stored in the {@code model_id} column. */
    @TableField("model_id")
    private String modelId;
    private String name;
    private String displayName;
    @TableField("group_code")
    private String groupCode;
    private Boolean isBuiltIn;
    private String color;
    @TableField("enable_2d_view")
    private Boolean enable2dView;

    /** Alias kept for callers that refer to the code as "model code". */
    public String getModelCode() {
        return this.modelId;
    }
}
