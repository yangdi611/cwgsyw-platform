package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ci_attribute")
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
    private String enumOptions;
    private Integer sortOrder;
}
