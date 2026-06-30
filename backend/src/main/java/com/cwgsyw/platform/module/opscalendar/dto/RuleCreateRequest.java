package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class RuleCreateRequest {
    private String name;
    private String description;
    private String taskType;
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
    private Boolean enabled;
    private List<ChecklistItemDTO> checklistItems;
}
