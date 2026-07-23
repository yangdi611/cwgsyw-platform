package com.cwgsyw.platform.module.task.runtime.dto;

import java.time.LocalDateTime;
import java.util.Map;

public record TaskEventVO(
    Long id,
    String eventType,
    Long operatorId,
    Map<String, Object> eventData,
    LocalDateTime createdAt
) {
}
