package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class TemplateVO {
    private Long id;
    private String name;
    private String templateType;
    private String taskType;
    private String titleTemplate;
    private String bodyTemplate;
    private String checklistJson;
    private Boolean enabled;
    private Boolean isBuiltin;
    private LocalDateTime createdAt;
}
