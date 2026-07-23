package com.cwgsyw.platform.module.approval.workflow;

public record ApprovalProcessDeployment(
    String processDefinitionId,
    String processDefinitionKey,
    Integer processDefinitionVersion
) {
}
