package com.cwgsyw.platform.module.approval.workflow;

import java.time.LocalDateTime;

public record ApprovalWorkflowTask(
    String id,
    String processInstanceId,
    String processDefinitionId,
    String nodeKey,
    String nodeName,
    Long submissionId,
    Long roundId,
    LocalDateTime createdAt
) {
}
