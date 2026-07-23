package com.cwgsyw.platform.module.task.template.dto;

public record TemplateValidationIssue(
    String code,
    String fieldKey,
    String path,
    String message
) {
}
