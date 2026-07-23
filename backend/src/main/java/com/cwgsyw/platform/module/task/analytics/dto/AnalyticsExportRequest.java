package com.cwgsyw.platform.module.task.analytics.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record AnalyticsExportRequest(
    @NotNull @Valid AnalyticsQueryRequest query,
    String format,
    String fileName
) {}
