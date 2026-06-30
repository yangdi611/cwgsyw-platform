package com.cwgsyw.platform.module.opscalendar.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ops_schedule_notification_log")
public class OpsScheduleNotificationLog {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId = "default";
    private Long taskId;
    private String stage;
    private Long userId;
    private String channel = "notification";
    private Boolean success = false;
    private String errorMessage;
    private Integer retryCount = 0;
    private LocalDateTime sentAt;
    private LocalDateTime lastErrorAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
