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
    private String defaultValue;

    /**
     * Option JSONB field for enum/enummulti field types.
     * Format: [{"id":"linux","name":"Linux","isDefault":true}]
     */
    private List<Map<String, Object>> option;

    /**
     * @deprecated Use {@link #option} instead. This field accepts the old enumOptions string.
     */
    @Deprecated
    private String enumOptions;

    private Integer sortOrder;
}
