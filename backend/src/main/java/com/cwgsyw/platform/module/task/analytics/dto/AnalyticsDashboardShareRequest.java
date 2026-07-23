package com.cwgsyw.platform.module.task.analytics.dto;

import jakarta.validation.constraints.NotBlank;

public record AnalyticsDashboardShareRequest(@NotBlank String scopeType, Long ownerGroupId) {}
