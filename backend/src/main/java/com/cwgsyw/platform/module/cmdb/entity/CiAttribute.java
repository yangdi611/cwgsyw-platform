package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "ci_attribute", autoResultMap = true)
public class CiAttribute extends BaseEntity {
    private String modelId;
    private String fieldKey;
    private String name;
    private String groupId;
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
    @TableField(value = "option", typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> option;

    /**
     * @deprecated Use {@link #option} instead. This field reads the old enumOptions string column.
     */
    @Deprecated
    private String enumOptions;

    private Integer sortOrder;
}
