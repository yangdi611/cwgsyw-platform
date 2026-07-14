package com.cwgsyw.platform.module.org.dto;

public record GroupLifecycleResult(
    Long groupId,
    String state,
    boolean changed,
    Long auditId,
    boolean restoredRelations
) {}
