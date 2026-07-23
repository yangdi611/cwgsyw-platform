package com.cwgsyw.platform.module.task.template.form;

import com.cwgsyw.platform.module.task.template.dto.FieldTypeMetadata;
import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.dto.TemplateValidationIssue;

import java.util.List;

public interface FieldTypeHandler {
    FieldTypeMetadata metadata();

    List<TemplateValidationIssue> validateConfiguration(TaskFieldDefinition field);

    FieldValueResult normalizeAndValidate(TaskFieldDefinition field, Object value, String path);
}
