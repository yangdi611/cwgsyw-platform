package com.cwgsyw.platform.module.task.runtime.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * 任务提交版本实体（不可变）
 */
@Data
@TableName(value = "task_submission", autoResultMap = true)
public class TaskSubmission {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;

    /**
     * 任务ID
     */
    private Long taskId;

    private Long templateVersionId;

    /**
     * 提交版本号（从1开始）
     */
    private Integer version;

    private String idempotencyKey;

    /**
     * 表单数据（不可变）
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> formData;

    /**
     * 计算值（公式字段结果）
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> computedValues;

    /**
     * 模板版本快照
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> templateVersionSnapshot;

    /**
     * 组织快照
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> organizationSnapshot;

    /**
     * CI 引用快照
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> ciReferencesSnapshot;

    /**
     * 状态：current/superseded/rejected
     */
    private String status;

    private Boolean effective;

    private Long supersedesSubmissionId;

    private String contentHash;

    /**
     * 提交人
     */
    private Long submittedBy;

    /**
     * 提交时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime submittedAt;
}
