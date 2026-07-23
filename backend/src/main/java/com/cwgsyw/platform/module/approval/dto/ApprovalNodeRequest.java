package com.cwgsyw.platform.module.approval.dto;

public record ApprovalNodeRequest(
    String key,
    String name,
    String approverType,
    Long userId,
    Long groupId,
    String roleCode
) {
}
