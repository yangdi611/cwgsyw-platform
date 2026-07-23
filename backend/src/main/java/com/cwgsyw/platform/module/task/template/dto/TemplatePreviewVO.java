package com.cwgsyw.platform.module.task.template.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;

@Value
@Builder
public class TemplatePreviewVO {
    TaskTemplateVersionVO schema;
    String role;
    Map<String, Object> formData;
    Map<String, Object> computedValues;
    Map<String, Boolean> visibleFields;
    Map<String, Boolean> requiredFields;
    List<TemplateValidationIssue> valueIssues;
}
