package com.cwgsyw.platform.module.cmdb.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SaveCiAttributeRequest {
    @NotBlank private String fieldKey;
    @NotBlank private String name;
    private String groupId;
    @NotBlank private String fieldType;
    private Object option;
    private String defaultVal;
    private String placeholder;
    private String unit;
    private Boolean isRequired;
    private Boolean isEditable;
    private Boolean isUnique;
    private Boolean isListShow;
    private Integer sortOrder;
}
