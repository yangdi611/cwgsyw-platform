package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.util.List;

@Data
public class TemplateVO {
    private Long id;
    private String name;
    private String description;
    private Integer version;
    // Boolean 包装类型 + 字段名不带 is 前缀，避免 Lombok/Jackson 的 boolean is-prefix 序列化坑。
    // 全局 SNAKE_CASE 策略会把 active → "active"、hasDocx → "has_docx"
    private Boolean active;
    private Boolean hasDocx;
    private String docType;
    private List<FieldConfigVO> fields;
    private String createdAt;
}
