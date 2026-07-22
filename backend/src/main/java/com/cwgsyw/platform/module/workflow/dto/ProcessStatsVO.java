package com.cwgsyw.platform.module.workflow.dto;

import lombok.Data;

@Data
public class ProcessStatsVO {
    private String processDefinitionKey;
    private String processDefinitionId;
    private String name;
    private Integer version;
    private long totalStarted;
    private long runningCount;
    private long finishedCount;
    private double successRate;
    private double avgDurationSeconds;
}
