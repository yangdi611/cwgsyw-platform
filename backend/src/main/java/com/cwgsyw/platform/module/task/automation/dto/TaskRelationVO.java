package com.cwgsyw.platform.module.task.automation.dto;

import java.time.LocalDateTime;

public record TaskRelationVO(
    Long id, Long sourceTaskId, Long targetTaskId, String relationType,
    Long automationExecutionId, LocalDateTime createdAt
) {}
