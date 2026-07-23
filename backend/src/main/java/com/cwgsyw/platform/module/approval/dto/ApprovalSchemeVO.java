package com.cwgsyw.platform.module.approval.dto;

import java.time.LocalDateTime;

public record ApprovalSchemeVO(
    Long id,
    String code,
    String name,
    String description,
    String status,
    Long latestVersionId,
    String scopeType,
    Long ownerGroupId,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    ApprovalSchemeVersionVO latestVersion
) {
}
