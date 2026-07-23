package com.cwgsyw.platform.module.approval.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record ApprovalTaskSummaryVO(
    String approvalTaskId,
    Long taskId,
    Long submissionId,
    Long approvalRoundId,
    String title,
    String nodeKey,
    String nodeName,
    String priority,
    LocalDate businessDate,
    LocalDateTime dueAt,
    Boolean overdue,
    LocalDateTime createdAt
) {
}
