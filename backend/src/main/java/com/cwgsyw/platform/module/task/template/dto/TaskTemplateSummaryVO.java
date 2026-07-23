package com.cwgsyw.platform.module.task.template.dto;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;

@Value
@Builder
public class TaskTemplateSummaryVO {
    Long id;
    String code;
    String name;
    String category;
    String description;
    String status;
    Long latestVersionId;
    Boolean builtin;
    String scopeType;
    Long ownerGroupId;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
