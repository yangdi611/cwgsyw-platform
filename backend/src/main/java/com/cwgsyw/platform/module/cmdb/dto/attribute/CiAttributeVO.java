package com.cwgsyw.platform.module.cmdb.dto.attribute;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;
import java.util.Map;

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

    /**
     * Option JSONB field for enum/enummulti field types.
     * Format: [{"id":"linux","name":"Linux","isDefault":true}]
     */
    private List<Map<String, Object>> option;

    /**
     * @deprecated Use {@link #option} instead. This field returns the old enumOptions string.
     */
    @Deprecated
    private String enumOptions;

    private Integer sortOrder;
}
