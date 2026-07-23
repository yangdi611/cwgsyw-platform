package com.cwgsyw.platform.module.task.analytics.subscription.dto;

import java.time.LocalDateTime;
import java.util.Map;

public record SubscriptionVO(
    Long id, Long dashboardId, String name, String recipientType, Map<String, Object> recipientConfig,
    Map<String, Object> scheduleConfig, String channel, String status,
    LocalDateTime lastSentAt, LocalDateTime nextSendAt, LocalDateTime createdAt, LocalDateTime updatedAt
) {}
