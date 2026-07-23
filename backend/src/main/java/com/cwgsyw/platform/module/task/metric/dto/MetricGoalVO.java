package com.cwgsyw.platform.module.task.metric.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

public record MetricGoalVO(
    Long id, Long metricId, String metricName, String scopeType, String scopeKey,
    String periodType, Map<String, Object> periodConfig, BigDecimal targetValue,
    BigDecimal actualValue, BigDecimal completionRate, BigDecimal warningThreshold,
    BigDecimal criticalThreshold, String comparison, String status,
    LocalDate effectiveFrom, LocalDate effectiveTo
) {}
