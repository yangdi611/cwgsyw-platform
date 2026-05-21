package com.cwgsyw.platform.module.workflow.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class TaskVO {
    private String taskId;
    private String processInstanceId;
    private String taskName;
    private String businessKey;
    private String businessType;
    private Long   businessId;
    private String assignee;
    private LocalDateTime createTime;
}
