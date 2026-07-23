package com.cwgsyw.platform.module.task.template.dto;

import lombok.Data;

import java.util.Map;

@Data
public class TemplatePreviewRequest {
    private String role;
    private Map<String, Object> formData;
}
