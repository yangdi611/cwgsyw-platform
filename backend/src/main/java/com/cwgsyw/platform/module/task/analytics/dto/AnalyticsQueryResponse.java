package com.cwgsyw.platform.module.task.analytics.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record AnalyticsQueryResponse(
    List<String> columns,
    List<Map<String, Object>> rows,
    long scannedFacts,
    LocalDateTime generatedAt,
    String effectivePolicy,
    Map<String, Object> definition
) {}
