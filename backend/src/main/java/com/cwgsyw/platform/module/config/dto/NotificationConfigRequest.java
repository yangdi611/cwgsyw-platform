package com.cwgsyw.platform.module.config.dto;

import lombok.Data;

@Data
public class NotificationConfigRequest {
    private Boolean reminderEnabled;
    private String reminderCron;
    private String reminderTemplate;
}
