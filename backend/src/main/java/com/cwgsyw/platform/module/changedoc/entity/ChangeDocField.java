package com.cwgsyw.platform.module.changedoc.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.util.Map;

@Data
@TableName(value = "change_doc_field", autoResultMap = true)
public class ChangeDocField {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long templateId;
    private String fieldKey;
    private String label;
    private String fieldType;
    private Integer sortOrder;
    private Boolean required;
    private Boolean inForm;
    private String placeholder;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> config;
}
