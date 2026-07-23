package com.cwgsyw.platform.module.task.analytics.dto;

import java.util.List;
import java.util.Map;

public record AnalyticsFieldMetadata(
    String key,
    String label,
    String type,
    List<String> roles,
    List<String> aggregations,
    String unit,
    String defaultAggregation,
    Map<String, Object> validation
) {}
