package com.cwgsyw.platform.module.task.plan.dto;

public record ResolvedCiInstance(
    Long id,
    String name,
    String modelCode,
    String modelName,
    String modelGroupCode,
    String modelGroupName,
    String status,
    String owner
) {
}
