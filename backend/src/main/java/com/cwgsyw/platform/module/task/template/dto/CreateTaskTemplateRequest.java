package com.cwgsyw.platform.module.task.template.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class CreateTaskTemplateRequest {
    @NotBlank
    @Pattern(regexp = "^[a-z][a-z0-9_]{1,99}$", message = "模板编码必须是小写字母、数字或下划线")
    private String code;
    @NotBlank
    @Size(max = 255)
    private String name;
    @Size(max = 100)
    private String category;
    private String description;
    private String scopeType;
    private Long ownerGroupId;
    private String instructions;
    private Map<String, Object> layout;
    private Map<String, Object> completionPolicy;
    private Map<String, Object> defaultAssignment;
    private Map<String, Object> defaultReminder;
    private Long defaultApprovalSchemeVersionId;
    @Valid
    private List<TaskFieldDefinition> fields;
}
