package com.cwgsyw.platform.module.cmdb.dto.model;

import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class UpdateModelRequest {
    private String displayName;
    private String group;
    private String description;

    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "颜色格式必须为 #RRGGBB")
    private String color;
    private Boolean enable2dView;
}
