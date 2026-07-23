package com.cwgsyw.platform.module.task.template.dto;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;

@Value
@Builder
public class TaskTemplateVersionSummaryVO {
    Long id;
    Long templateId;
    Integer version;
    String status;
    String name;
    LocalDateTime publishedAt;
    LocalDateTime updatedAt;
}
