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
@TableName(value = "task_automation_rule", autoResultMap = true)
public class TaskAutomationRule {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String name;
    private String description;
    private String triggerType;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> triggerConfig;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> conditionConfig;
    private String actionType;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> actionConfig;
    private String status;
    private Long updatedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
