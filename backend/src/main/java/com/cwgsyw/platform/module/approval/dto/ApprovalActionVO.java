package com.cwgsyw.platform.module.approval.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record ApprovalActionVO(
    Long id,
    String flowableTaskId,
    String nodeKey,
    String nodeName,
    String action,
    Long approverId,
    Map<String, Object> approverSnapshot,
    String comment,
    List<Map<String, Object>> fieldComments,
    List<Map<String, Object>> attachmentComments,
    LocalDateTime createdAt
) {
}
