package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.util.List;

@Data
public class TemplateVO {
    private Long id;
    private String name;
    private String description;
    private Integer version;
    private boolean isActive;
    private boolean hasDocx;
    private String docType;
    private List<FieldConfigVO> fields;
    private String createdAt;
}
