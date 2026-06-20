package com.cwgsyw.platform.module.cmdb.dto.attribute;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
@Data
public class CiAttributeVO {
    private Long id;
    private String modelId;
    private String fieldKey;
    private String name;
    private String groupId;
    private String groupName;
    private String fieldType;
    private Boolean isRequired;
    private Boolean isEditable;
    private Boolean isUnique;
    private Boolean isBuiltIn;
    private Boolean isListShow;
    private String defaultValue;
    private String enumOptions;
    private Integer sortOrder;
}
