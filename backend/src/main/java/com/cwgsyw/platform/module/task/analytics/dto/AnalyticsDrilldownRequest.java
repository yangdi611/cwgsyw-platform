package com.cwgsyw.platform.module.task.analytics.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record AnalyticsDrilldownRequest(
    @NotNull @Valid AnalyticsQueryRequest query,
    Map<String, Object> dimensions,
    Integer page,
    Integer size
) {}
