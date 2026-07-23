package com.cwgsyw.platform.module.task.analytics.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record AnalyticsDashboardVO(
    Long id,
    String code,
    String name,
    String description,
    String scopeType,
    Long ownerId,
    Long ownerGroupId,
    Map<String, Object> layoutConfig,
    List<AnalyticsWidgetVO> widgets,
    boolean canManage,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}
