package com.cwgsyw.platform.module.cmdb.spatial.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("ci_spatial_version_asset")
public class SpatialVersionAsset {
    @TableId
    private Long id;
    private String tenantId;
    private Long layoutVersionId;
    private Long assetId;
    private String usage;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT)
    private Long createdBy;
}
