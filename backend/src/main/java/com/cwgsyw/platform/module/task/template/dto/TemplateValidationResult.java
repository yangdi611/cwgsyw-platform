package com.cwgsyw.platform.module.task.template.dto;

import java.util.List;

public record TemplateValidationResult(boolean valid, List<TemplateValidationIssue> issues) {
    public static TemplateValidationResult of(List<TemplateValidationIssue> issues) {
        return new TemplateValidationResult(issues.isEmpty(), List.copyOf(issues));
    }
}
