package com.cwgsyw.platform.module.opscalendar.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ops_schedule_rule")
public class OpsScheduleRule extends BaseEntity {
    private String name;
    private String description;
    private String taskType;
    private Boolean enabled = true;
    private String triggerType;
    private String triggerConfig = "{}";
    private Integer generateDaysAhead = 7;
    private String reminderConfig = "{}";
    private String dueConfig = "{}";
    private String assigneeRule = "{}";
    private String recipientRule = "{}";
    private String escalationRule = "{}";
    private Long templateId;
    private Long checklistTemplateId;
    private String visibility = "private";
    private String publicSummary;
    private Boolean sensitive = false;
    private LocalDateTime nextGenerateAt;
    private LocalDateTime lastGeneratedAt;
}
