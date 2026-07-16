package com.cwgsyw.platform.module.workflow.dto;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class HistoricActivityVO {
    private String activityId;
    private String activityName;
    private String activityType;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String assignee;
}
