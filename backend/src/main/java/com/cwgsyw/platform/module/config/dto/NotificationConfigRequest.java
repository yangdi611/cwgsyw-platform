package com.cwgsyw.platform.module.config.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class NotificationConfigRequest {
    @JsonAlias("reminder_enabled")  private Boolean reminderEnabled;
    @JsonAlias("reminder_cron")     private String reminderCron;
    @JsonAlias("reminder_template") private String reminderTemplate;
}
