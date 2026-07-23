package com.cwgsyw.platform.module.task.automation.dto;

import java.time.LocalDateTime;
import java.util.Map;

public record AutomationRuleVO(
    Long id, String name, String description, String triggerType, Map<String, Object> triggerConfig,
    Map<String, Object> conditionConfig, String actionType, Map<String, Object> actionConfig,
    String status, LocalDateTime createdAt, LocalDateTime updatedAt
) {}
