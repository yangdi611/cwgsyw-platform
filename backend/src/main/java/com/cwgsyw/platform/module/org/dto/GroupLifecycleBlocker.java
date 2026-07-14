package com.cwgsyw.platform.module.org.dto;

public record GroupLifecycleBlocker(
    String reasonCode,
    String referenceType,
    long count,
    String message,
    String resolution
) {}
