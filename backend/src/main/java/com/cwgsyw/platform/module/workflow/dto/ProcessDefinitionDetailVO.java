package com.cwgsyw.platform.module.workflow.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ProcessDefinitionDetailVO {
    private String id;
    private String name;
    private String key;
    private int version;
    private String description;
    private String category;
    private String deploymentId;
    private LocalDateTime deploymentTime;
    private boolean suspended;
    private String tenantId;
    private String xml;
}
