package com.cwgsyw.platform.module.cmdb.spatial.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import java.time.LocalDateTime;
import lombok.Data;

/**
 * Spatial tables use PostgreSQL BOOLEAN soft-deletion columns. Keeping the explicit
 * literals here prevents MyBatis-Plus from emitting the numeric default used by some
 * legacy entities, without changing platform-wide entity behavior.
 */
@Data
public abstract class SpatialBaseEntity {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId = "default";
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
    @TableField(fill = FieldFill.INSERT)
    private Long createdBy;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Long updatedBy;
    @TableLogic(value = "false", delval = "true")
    private Boolean isDeleted = false;
    private LocalDateTime deletedAt;
    private Long deletedBy;
}
