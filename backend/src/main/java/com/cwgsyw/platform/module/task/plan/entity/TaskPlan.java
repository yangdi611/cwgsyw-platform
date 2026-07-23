package com.cwgsyw.platform.module.task.plan.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * 任务计划实体（一次性与周期性统一）
 */
@Data
@TableName(value = "task_plan", autoResultMap = true)
public class TaskPlan {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;

    /**
     * 计划名称
     */
    private String name;

    /**
     * 计划描述
     */
    private String description;

    /**
     * 模板版本ID（固化）
     */
    private Long templateVersionId;

    /**
     * 审批方案版本ID（可空，固化）
     */
    private Long approvalSchemeVersionId;

    /**
     * 调度类型：once/daily/weekly/monthly/quarterly/semiannual/yearly/cron/holiday_relative
     */
    private String scheduleType;

    /**
     * 调度配置（时间规则）
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> scheduleConfig;

    /**
     * 生成模式：per_user/per_group/shared/single
     */
    private String generationMode;

    /**
     * 分配规则（人员、组、排班规则）
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> assignmentRule;

    /**
     * CI 范围配置（计划级动态范围）
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> ciScopeConfig;

    /**
     * 提醒配置
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> reminderConfig;

    /**
     * 逾期升级配置
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> escalationConfig;

    /**
     * 提前生成天数
     */
    private Integer generateAheadDays;

    /**
     * 生效开始日期
     */
    private LocalDate startDate;

    /**
     * 生效结束日期
     */
    private LocalDate endDate;

    /**
     * 状态：draft/active/paused/finished/archived
     */
    private String status;

    /**
     * 下次生成时间
     */
    private LocalDateTime nextGenerateAt;

    /**
     * 上次生成时间
     */
    private LocalDateTime lastGeneratedAt;

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
