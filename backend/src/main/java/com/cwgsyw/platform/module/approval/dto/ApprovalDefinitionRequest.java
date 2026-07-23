package com.cwgsyw.platform.module.approval.dto;

import java.util.List;
import java.util.Set;

public record ApprovalDefinitionRequest(
    List<ApprovalNodeRequest> nodes,
    Set<String> allowedActions
) {
}
