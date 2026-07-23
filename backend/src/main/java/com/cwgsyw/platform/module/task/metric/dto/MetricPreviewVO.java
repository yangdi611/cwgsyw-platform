package com.cwgsyw.platform.module.task.metric.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record MetricPreviewVO(
    Long metricId, LocalDate from, LocalDate to, BigDecimal systemValue, BigDecimal manualValue,
    BigDecimal difference, String selectedSourceRole, int sourceTaskCount,
    List<Long> factIds, List<Long> taskIds, List<Long> submissionIds
) {}
