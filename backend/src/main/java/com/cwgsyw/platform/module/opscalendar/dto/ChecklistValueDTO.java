package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;

@Data
public class ChecklistValueDTO {
    private Long itemId;
    private Boolean checked;
    private String value;
}
