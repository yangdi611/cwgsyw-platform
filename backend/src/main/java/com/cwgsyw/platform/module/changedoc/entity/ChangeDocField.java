package com.cwgsyw.platform.module.changedoc.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("change_doc_field")
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
}
