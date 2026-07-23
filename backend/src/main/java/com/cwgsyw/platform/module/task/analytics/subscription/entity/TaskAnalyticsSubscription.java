package com.cwgsyw.platform.module.task.analytics.subscription.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName(value = "task_analytics_subscription", autoResultMap = true)
public class TaskAnalyticsSubscription {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long dashboardId;
    private String name;
    private String recipientType;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> recipientConfig;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> scheduleConfig;
    private String channel;
    private String status;
    private LocalDateTime lastSentAt;
    private LocalDateTime nextSendAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
