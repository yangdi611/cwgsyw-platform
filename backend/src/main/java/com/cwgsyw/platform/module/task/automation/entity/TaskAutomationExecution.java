package com.cwgsyw.platform.module.task.automation.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName(value = "task_automation_execution", autoResultMap = true)
public class TaskAutomationExecution {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long ruleId;
    private String sourceType;
    private Long sourceId;
    private String eventType;
    private Long sourceTaskId;
    private Long sourceSubmissionId;
    private LocalDateTime sourceOccurredAt;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> sourceAttributes;
    private String dedupeKey;
    private String status;
    private Long resultTaskId;
    private Integer attemptCount;
    private LocalDateTime nextAttemptAt;
    private String lastError;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
