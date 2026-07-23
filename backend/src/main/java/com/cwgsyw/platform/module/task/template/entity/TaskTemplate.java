package com.cwgsyw.platform.module.task.template.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 任务模板实体
 */
@Data
@TableName("task_template")
public class TaskTemplate {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;

    /**
     * 模板编码（租户内唯一）
     */
    private String code;

    /**
     * 模板名称
     */
    private String name;

    /**
     * 分类
     */
    private String category;

    /**
     * 描述
     */
    private String description;

    /**
     * 状态：draft/published/deprecated/archived
     */
    private String status;

    /**
     * 最新版本ID
     */
    private Long latestVersionId;

    /**
     * 是否内置模板
     */
    private Boolean builtin;

    /**
     * 范围类型：tenant/group/private
     */
    private String scopeType;

    /**
     * 所属组ID（scope_type=group时）
     */
    private Long ownerGroupId;

    private Long createdBy;

    private Long updatedBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Boolean isDeleted;

    private LocalDateTime deletedAt;

    private Long deletedBy;
}
