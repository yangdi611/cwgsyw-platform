package com.cwgsyw.platform.module.task.template.dto;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;
import java.util.List;

@Value
@Builder
public class TaskTemplateDetailVO {
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
    List<TaskTemplateVersionSummaryVO> versions;
}
