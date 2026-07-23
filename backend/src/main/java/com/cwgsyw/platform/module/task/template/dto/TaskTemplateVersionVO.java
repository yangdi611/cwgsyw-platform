package com.cwgsyw.platform.module.task.template.dto;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Value
@Builder
public class TaskTemplateVersionVO {
    Long id;
    Long templateId;
    Integer version;
    String status;
    String name;
    String description;
    String instructions;
    Map<String, Object> layout;
    Map<String, Object> completionPolicy;
    Map<String, Object> defaultAssignment;
    Map<String, Object> defaultReminder;
    Long defaultApprovalSchemeVersionId;
    Long publishedBy;
    LocalDateTime publishedAt;
    LocalDateTime updatedAt;
    List<TaskFieldDefinition> fields;
}
