package com.cwgsyw.platform.module.approval.workflow;

public record ApprovalProcessNode(
    String key,
    String name,
    String assignee,
    String candidateGroup
) {
}
