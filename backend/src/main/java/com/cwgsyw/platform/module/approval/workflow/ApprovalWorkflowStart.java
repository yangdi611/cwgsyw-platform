package com.cwgsyw.platform.module.approval.workflow;

public record ApprovalWorkflowStart(
    String tenantId,
    Long submissionId,
    Long roundId,
    String processDefinitionId,
    Long submitterId
) {
}
