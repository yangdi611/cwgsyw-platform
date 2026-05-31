package com.cwgsyw.platform.module.workflow.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
public class InstanceVO {
    private String id;
    private String processDefinitionId;
    private String processDefinitionName;
    private String processDefinitionKey;
    private String businessKey;
    private String startUserId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private boolean ended;
    private boolean suspended;
    private Map<String, Object> variables;
}
