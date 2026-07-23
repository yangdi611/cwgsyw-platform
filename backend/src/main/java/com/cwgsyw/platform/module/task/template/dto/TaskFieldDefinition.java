package com.cwgsyw.platform.module.task.template.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;

@Data
public class TaskFieldDefinition {
    private Long id;
    private String parentFieldKey;
    @NotBlank
    private String key;
    @NotBlank
    private String label;
    @NotBlank
    private String type;
    private Integer sortOrder;
    private Boolean required;
    private Object defaultValue;
    private Map<String, Object> validation;
    private Map<String, Object> display;
    private Map<String, Object> visibility;
    private Map<String, Object> condition;
    private Map<String, Object> formula;
    private Map<String, Object> analytics;
    private Boolean sensitive;
}
