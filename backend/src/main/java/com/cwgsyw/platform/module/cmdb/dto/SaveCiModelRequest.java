package com.cwgsyw.platform.module.cmdb.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SaveCiModelRequest {
    @NotBlank private String modelId;
    @NotBlank private String name;
    private String icon;
    private String groupCode;
    private String description;
    private Integer sortOrder;
}
