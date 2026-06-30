package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;

@Data
public class TemplateRequest {
    private String name;
    private String templateType;   // notification / checklist / mixed
    private String taskType;
    private String titleTemplate;
    private String bodyTemplate;
    private String checklistJson;  // JSON array of checklist item defs
    private Boolean enabled;
}
