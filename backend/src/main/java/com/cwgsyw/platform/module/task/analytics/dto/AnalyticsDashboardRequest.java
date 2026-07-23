package com.cwgsyw.platform.module.task.analytics.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.Map;

public record AnalyticsDashboardRequest(
    String code,
    @NotBlank String name,
    String description,
    String scopeType,
    Long ownerGroupId,
    Map<String, Object> layoutConfig
) {}
