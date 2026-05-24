package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;

@Data
public class FieldConfigVO {
    private Long id;
    private String fieldKey;
    private String label;
    private String fieldType;
    private Integer sortOrder;
    private Boolean required;
    private Boolean inForm;
    private String placeholder;
}
