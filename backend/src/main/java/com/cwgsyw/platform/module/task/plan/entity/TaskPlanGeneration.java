package com.cwgsyw.platform.module.task.plan.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("task_plan_generation")
public class TaskPlanGeneration {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long planId;
    private String occurrenceKey;
    private LocalDateTime occurrenceAt;
    private String subjectType;
    private Long subjectId;
    private String status;
    private Long taskId;
    private String errorCode;
    private String errorMessage;
    private Integer attemptCount;
    private LocalDateTime lastAttemptAt;
    private LocalDateTime createdAt;
}
