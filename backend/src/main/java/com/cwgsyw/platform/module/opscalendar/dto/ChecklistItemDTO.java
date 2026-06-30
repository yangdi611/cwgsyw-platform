package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;

@Data
public class ChecklistItemDTO {
    private String title;
    private Boolean required;
    private String inputType;   // checkbox / text / number / select / attachment
    private String options;     // JSON for select
    private Integer sortOrder;
}
