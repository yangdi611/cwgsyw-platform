package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName(value = "ci_attribute", autoResultMap = true)
public class CiAttribute {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String modelId;
    private String fieldKey;
    private String name;
    private String groupId;
    private String fieldType;
    @TableField(typeHandler = com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler.class)
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
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long createdBy;
}
