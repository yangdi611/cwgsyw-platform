package com.cwgsyw.platform.module.cmdb.dto.attribute;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class UpdateAttributeRequest {
    private String name;
    private Boolean isRequired;
    private Boolean isEditable;
    private Boolean isListShow;
    private Boolean isDrawerShow;
    private String defaultValue;

    /**
     * Option JSONB. enum/enummulti 为数组；table 为对象 schema（§4.1）。类型放宽为 Object。
     */
    private Object option;

    /**
     * @deprecated Use {@link #option} instead. This field accepts the old enumOptions string.
     */
    @Deprecated
    private String enumOptions;

    private Integer sortOrder;
}
