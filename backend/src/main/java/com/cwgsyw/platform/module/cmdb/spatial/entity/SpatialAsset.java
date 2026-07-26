package com.cwgsyw.platform.module.cmdb.spatial.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

/** Metadata for a private spatial reference image in object storage. */
@Data
@TableName("ci_spatial_asset")
public class SpatialAsset {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId = "default";
    private Long layoutId;
    private String assetType;
    private String objectKey;
    private String originalName;
    private String contentType;
    private Long byteSize;
    private String sha256;
    private Integer pixelWidth;
    private Integer pixelHeight;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT)
    private Long createdBy;
    @TableLogic(value = "false", delval = "true")
    private Boolean isDeleted = false;
    private LocalDateTime deletedAt;
    private Long deletedBy;
}
