package com.cwgsyw.platform.module.approval.workflow;

import com.cwgsyw.platform.module.workflow.event.WorkflowBusinessInstance;
import com.cwgsyw.platform.security.SecurityUser;

import java.util.List;
import java.util.Map;

public interface TaskApprovalWorkflowPort {
    ApprovalProcessDeployment publish(String tenantId, String processKey, String name,
                                      List<ApprovalProcessNode> nodes);

    WorkflowBusinessInstance start(ApprovalWorkflowStart command);

    List<ApprovalWorkflowTask> listPending(SecurityUser user);

    ApprovalWorkflowTask requirePending(SecurityUser user, String workflowTaskId);

    void complete(SecurityUser user, ApprovalWorkflowTask task, boolean approved,
                  String comment, Map<String, Object> variables);

    void returnToNode(SecurityUser user, ApprovalWorkflowTask task, String targetNodeKey,
                      String comment, Map<String, Object> variables);
}
