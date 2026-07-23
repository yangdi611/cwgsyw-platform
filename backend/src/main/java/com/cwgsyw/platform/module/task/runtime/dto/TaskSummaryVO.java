package com.cwgsyw.platform.module.task.runtime.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record TaskSummaryVO(
    Long id,
    String title,
    String description,
    Long planId,
    Long templateVersionId,
    String templateName,
    LocalDate businessDate,
    LocalDateTime plannedStartAt,
    LocalDateTime dueAt,
    String priority,
    String executionStatus,
    String approvalStatus,
    Long assigneeId,
    Long groupId,
    boolean overdue,
    TaskActionsVO actions
) {
}
