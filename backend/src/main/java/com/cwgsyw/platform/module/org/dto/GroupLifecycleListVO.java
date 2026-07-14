package com.cwgsyw.platform.module.org.dto;

import java.time.LocalDateTime;
import java.util.List;

public record GroupLifecycleListVO(
    Long id,
    String tenantId,
    String code,
    String name,
    String description,
    Long leaderId,
    String leaderRealName,
    String groupType,
    boolean isBuiltin,
    int memberCount,
    List<String> memberPreview,
    String state,
    LocalDateTime archivedAt,
    Long archivedBy,
    String archivedByName,
    LocalDateTime updatedAt
) {}
