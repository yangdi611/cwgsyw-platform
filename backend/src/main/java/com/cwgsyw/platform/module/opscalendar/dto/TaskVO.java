package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class TaskVO {
    private Long id;
    private Long ruleId;
    private String title;
    private String taskType;
    private String status;
    private LocalDateTime plannedStartAt;
    private LocalDateTime dueAt;
    private Long assigneeId;
    private String assigneeName;
    private String assigneePhone;
    private Long groupId;
    private String groupName;
    private String priority;
    private String sourceType;
    private String visibility;
    private String publicSummary;
    private Boolean sensitive;
    private String resultStatus;
    private String riskLevel;
    private LocalDateTime completedAt;
    private Boolean canViewDetail;
    private Boolean canOperate;
}
