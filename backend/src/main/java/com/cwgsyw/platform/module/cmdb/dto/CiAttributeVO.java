package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;

@Data
public class CiAttributeVO {
    private Long id;
    private String modelId;
    private String fieldKey;
    private String name;
    private String groupId;
    private String fieldType;
    private Object option;
    private String defaultVal;
    private String placeholder;
    private String unit;
    private Boolean isRequired;
    private Boolean isEditable;
    private Boolean isUnique;
    private Boolean isBuiltIn;
    private Boolean isListShow;
    private Integer sortOrder;
}
