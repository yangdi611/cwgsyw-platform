package com.cwgsyw.platform.module.task.runtime.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * 任务实例实体
 */
@Data
@TableName(value = "task_instance", autoResultMap = true)
public class TaskInstance {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;

    /**
     * 计划ID（一次性任务可为null）
     */
    private Long planId;

    /**
     * 生成记录ID
     */
    private Long generationId;

    /**
     * 模板版本ID
     */
    private Long templateVersionId;

    /**
     * 审批方案版本ID（可空）
     */
    private Long approvalSchemeVersionId;

    /**
     * 任务标题
     */
    private String title;

    /**
     * 任务描述
     */
    private String description;

    /**
     * 业务日期
     */
    private LocalDate businessDate;

    /**
     * 计划开始时间
     */
    private LocalDateTime plannedStartAt;

    /**
     * 截止时间
     */
    private LocalDateTime dueAt;

    /**
     * 优先级：low/normal/high/critical
     */
    private String priority;

    /**
     * 执行状态：not_started/in_progress/submitted/changes_requested/completed/cancelled/exception_closed
     */
    private String executionStatus;

    /**
     * 审批状态：not_required/not_started/in_review/approved/changes_requested/terminated/failed
     */
    private String approvalStatus;

    /**
     * 负责人ID
     */
    private Long assigneeId;

    /**
     * 所属组ID
     */
    private Long groupId;

    /**
     * 当前草稿版本号
     */
    private Integer currentDraftRevision;

    /**
     * 当前有效提交ID
     */
    private Long currentSubmissionId;

    /**
     * 当前审批轮次ID
     */
    private Long currentApprovalRoundId;

    /**
     * 组织快照
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> organizationSnapshot;

    /**
     * CI 范围快照
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> ciScopeSnapshot;

    /**
     * 是否逾期
     */
    private Boolean overdue;

    /**
     * 开始时间
     */
    private LocalDateTime startedAt;

    /**
     * 提交时间
     */
    private LocalDateTime submittedAt;

    /**
     * 完成时间
     */
    private LocalDateTime completedAt;

    /**
     * 取消时间
     */
    private LocalDateTime cancelledAt;

    /**
     * 取消原因
     */
    private String cancelReason;

    /**
     * 乐观锁版本
     */
    @Version
    private Integer lockVersion;

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
