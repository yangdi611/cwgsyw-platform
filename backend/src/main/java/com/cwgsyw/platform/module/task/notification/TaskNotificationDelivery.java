package com.cwgsyw.platform.module.task.notification;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName(value = "task_notification_delivery", autoResultMap = true)
public class TaskNotificationDelivery {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long taskId;
    private Long submissionId;
    private Long approvalRoundId;
    private String eventType;
    private Long recipientId;
    private String channel;
    private String dedupeKey;
    private Long subscriptionId;
    private String batchKey;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> payload;
    private String status;
    private Integer attemptCount;
    private LocalDateTime nextAttemptAt;
    private LocalDateTime sentAt;
    private String lastError;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
