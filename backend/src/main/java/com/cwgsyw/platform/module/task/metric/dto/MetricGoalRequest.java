package com.cwgsyw.platform.module.task.metric.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

public record MetricGoalRequest(
    @NotNull Long metricId,
    @NotBlank String scopeType,
    String scopeKey,
    @NotBlank String periodType,
    Map<String, Object> periodConfig,
    @NotNull BigDecimal targetValue,
    BigDecimal warningThreshold,
    BigDecimal criticalThreshold,
    @NotBlank String comparison,
    @NotNull LocalDate effectiveFrom,
    @NotNull LocalDate effectiveTo
) {}
