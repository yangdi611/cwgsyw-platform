package com.cwgsyw.platform.module.cmdb.spatial.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

/** Query projection rebuilt only from a validated layout document. */
@Data
@TableName("ci_spatial_binding")
public class SpatialBinding {
    @TableId
    private Long id;
    private String tenantId;
    private Long layoutId;
    private Long layoutVersionId;
    private Long roomInstanceId;
    private String elementId;
    private String elementType;
    private Long ciInstanceId;
    private String ciModelIdSnapshot;
    private String displayNameSnapshot;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT)
    private Long createdBy;
}
