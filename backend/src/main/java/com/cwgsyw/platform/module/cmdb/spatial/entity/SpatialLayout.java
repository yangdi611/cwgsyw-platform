package com.cwgsyw.platform.module.cmdb.spatial.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/** Active or archived container for one room's spatial layout history. */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ci_spatial_layout")
public class SpatialLayout extends SpatialBaseEntity {
    private Long roomInstanceId;
    private String name;
    private String status;
    private Long draftVersionId;
    private Long publishedVersionId;
}
