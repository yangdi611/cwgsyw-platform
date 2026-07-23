package com.cwgsyw.platform.module.task.template.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateTaskTemplateRequest {
    @Size(max = 255)
    private String name;
    @Size(max = 100)
    private String category;
    private String description;
    private String scopeType;
    private Long ownerGroupId;
}
