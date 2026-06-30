package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
public class RuleVO {
    private Long id;
    private String name;
    private String description;
    private String taskType;
    private Boolean enabled;
    private String triggerType;
    private Map<String, Object> triggerConfig;
    private Integer generateDaysAhead;
    private Map<String, Object> reminderConfig;
    private Map<String, Object> dueConfig;
    private Map<String, Object> assigneeRule;
    private Map<String, Object> recipientRule;
    private Map<String, Object> escalationRule;
    private Long templateId;
    private Long checklistTemplateId;
    private String visibility;
    private String publicSummary;
    private Boolean sensitive;
    private LocalDateTime nextGenerateAt;
    private LocalDateTime lastGeneratedAt;
    private LocalDateTime createdAt;
}
