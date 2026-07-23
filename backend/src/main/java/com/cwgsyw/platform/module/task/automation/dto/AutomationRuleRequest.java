package com.cwgsyw.platform.module.task.automation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Map;

public record AutomationRuleRequest(
    @NotBlank @Size(max = 255) String name,
    String description,
    @NotBlank String triggerType,
    Map<String, Object> triggerConfig,
    Map<String, Object> conditionConfig,
    @NotBlank String actionType,
    Map<String, Object> actionConfig
) {}
