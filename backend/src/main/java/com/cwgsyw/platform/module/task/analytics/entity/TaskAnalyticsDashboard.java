package com.cwgsyw.platform.module.task.analytics.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName(value = "task_analytics_dashboard", autoResultMap = true)
public class TaskAnalyticsDashboard {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String code;
    private String name;
    private String description;
    private String scopeType;
    private Long ownerId;
    private Long ownerGroupId;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> layoutConfig;
    private Long createdBy;
    private Long updatedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
}
