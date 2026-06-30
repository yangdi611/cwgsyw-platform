package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;

@Data
public class TaskCloseExceptionRequest {
    private String reason;
    private String riskLevel;
}
