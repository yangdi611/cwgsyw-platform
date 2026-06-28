package com.cwgsyw.platform.module.cmdb.dto.attribute;

import lombok.Data;

import java.util.List;
import java.util.Map;

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
    private Boolean isDrawerShow;
    private String defaultValue;

    /**
     * Option JSONB. enum/enummulti 为数组；table 为对象 schema（§4.1）。类型放宽为 Object。
     */
    private Object option;

    /**
     * @deprecated Use {@link #option} instead. This field returns the old enumOptions string.
     */
    @Deprecated
    private String enumOptions;

    private Integer sortOrder;
}
