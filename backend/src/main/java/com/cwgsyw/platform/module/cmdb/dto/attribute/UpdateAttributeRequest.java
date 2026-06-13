package com.cwgsyw.platform.module.cmdb.dto.attribute;

import lombok.Data;

@Data
public class UpdateAttributeRequest {
    private String name;
    private Boolean isRequired;
    private Boolean isEditable;
    private Boolean isListShow;
    private String defaultValue;
    private String enumOptions;
    private Integer sortOrder;
}
