package com.cwgsyw.platform.module.task.template.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * 任务模板版本实体（不可变快照）
 */
@Data
@TableName(value = "task_template_version", autoResultMap = true)
public class TaskTemplateVersion {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;

    /**
     * 模板ID
     */
    private Long templateId;

    /**
     * 版本号（从1开始递增）
     */
    private Integer version;

    /**
     * 状态：draft/published/deprecated
     */
    private String status;

    /**
     * 发布时名称快照
     */
    private String nameSnapshot;

    /**
     * 发布时描述快照
     */
    private String descriptionSnapshot;

    /**
     * 富文本说明
     */
    private String instructions;

    /**
     * 布局配置（区块、分栏、顺序）
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> layoutSchema;

    /**
     * 完成条件配置
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> completionPolicy;

    /**
     * 默认分配规则
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> defaultAssignment;

    /**
     * 默认提醒配置
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> defaultReminder;

    /**
     * 默认审批方案版本ID
     */
    private Long defaultApprovalSchemeVersionId;

    /**
     * 发布人
     */
    private Long publishedBy;

    /**
     * 发布时间
     */
    private LocalDateTime publishedAt;

    private Long createdBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
