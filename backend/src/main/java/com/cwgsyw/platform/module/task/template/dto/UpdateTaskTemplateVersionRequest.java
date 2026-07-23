package com.cwgsyw.platform.module.task.template.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class UpdateTaskTemplateVersionRequest {
    @NotBlank
    private String name;
    private String description;
    private String instructions;
    private Map<String, Object> layout;
    private Map<String, Object> completionPolicy;
    private Map<String, Object> defaultAssignment;
    private Map<String, Object> defaultReminder;
    private Long defaultApprovalSchemeVersionId;
    @Valid
    private List<TaskFieldDefinition> fields;
}
