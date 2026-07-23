package com.cwgsyw.platform.module.task.analytics.subscription.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record SubscriptionRequest(
    @NotBlank String name,
    @NotBlank String recipientType,
    @NotNull Map<String, Object> recipientConfig,
    @NotNull Map<String, Object> scheduleConfig,
    @NotBlank String channel
) {}
