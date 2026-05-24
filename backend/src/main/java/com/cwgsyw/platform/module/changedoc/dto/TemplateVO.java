package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class TemplateVO {
    private Long id;
    private String name;
    private String description;
    private Integer version;
    private Boolean isActive;
    private boolean hasDocx;
    private List<FieldConfigVO> fields;
    private LocalDateTime createdAt;
}
