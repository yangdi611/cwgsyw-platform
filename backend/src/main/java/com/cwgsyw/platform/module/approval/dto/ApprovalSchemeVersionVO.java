package com.cwgsyw.platform.module.approval.dto;

import java.time.LocalDateTime;

public record ApprovalSchemeVersionVO(
    Long id,
    Long schemeId,
    Integer version,
    String status,
    ApprovalDefinitionRequest definition,
    String processDefinitionId,
    String processDefinitionKey,
    Integer processDefinitionVersion,
    Long publishedBy,
    LocalDateTime publishedAt,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
