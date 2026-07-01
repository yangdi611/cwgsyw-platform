package com.cwgsyw.platform.module.workflow.template.dto;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 模板实例视图。
 */
@Data
public class TemplateInstanceVO {
    private Long id;
    private String tenantId;
    private String templateCode;
    private String templateName;
    private String name;
    private String processKey;
    private String businessType;
    private String description;
    private String latestProcessDefinitionId;
    private Integer latestVersion;
    private String status;
    private boolean bound;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
