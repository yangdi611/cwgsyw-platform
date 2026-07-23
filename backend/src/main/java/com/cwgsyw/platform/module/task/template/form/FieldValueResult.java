package com.cwgsyw.platform.module.task.template.form;

import com.cwgsyw.platform.module.task.template.dto.TemplateValidationIssue;

import java.util.List;

public record FieldValueResult(Object value, List<TemplateValidationIssue> issues) {
    public static FieldValueResult valid(Object value) {
        return new FieldValueResult(value, List.of());
    }
}
