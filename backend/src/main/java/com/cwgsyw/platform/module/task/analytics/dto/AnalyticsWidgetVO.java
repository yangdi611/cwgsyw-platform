package com.cwgsyw.platform.module.task.analytics.dto;

import java.time.LocalDateTime;
import java.util.Map;

public record AnalyticsWidgetVO(
    Long id,
    Long dashboardId,
    String widgetType,
    String title,
    Map<String, Object> dataSourceConfig,
    Map<String, Object> displayConfig,
    Integer sortOrder,
    LocalDateTime updatedAt
) {}
