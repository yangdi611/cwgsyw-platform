package com.cwgsyw.platform.module.task.workitem.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record WorkItemVO(
    String itemType,
    String itemId,
    Long taskId,
    String approvalTaskId,
    String title,
    String subtitle,
    String nodeName,
    String status,
    String priority,
    LocalDate businessDate,
    LocalDateTime dueAt,
    boolean overdue,
    boolean actionRequired,
    String href
) {
}
