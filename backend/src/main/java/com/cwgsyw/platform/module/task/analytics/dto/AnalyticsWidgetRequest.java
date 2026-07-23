package com.cwgsyw.platform.module.task.analytics.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record AnalyticsWidgetRequest(
    @NotBlank String widgetType,
    @NotBlank String title,
    @NotNull Map<String, Object> dataSourceConfig,
    Map<String, Object> displayConfig,
    Integer sortOrder
) {}
