package com.cwgsyw.platform.module.org.dto;

import java.time.LocalDateTime;

public record GroupLifecycleGroupVO(
    Long id,
    String tenantId,
    String code,
    String name,
    String state,
    String groupType,
    boolean builtin,
    LocalDateTime updatedAt,
    LocalDateTime archivedAt
) {}
