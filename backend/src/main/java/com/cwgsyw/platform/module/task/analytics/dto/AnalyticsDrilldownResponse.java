package com.cwgsyw.platform.module.task.analytics.dto;

import java.util.List;
import java.util.Map;

public record AnalyticsDrilldownResponse(
    List<Map<String, Object>> records,
    Map<String, String> columnLabels,
    long total,
    int page,
    int size
) {}
