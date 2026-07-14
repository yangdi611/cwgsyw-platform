package com.cwgsyw.platform.module.org.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record GroupLifecyclePreflightVO(
    String action,
    boolean eligible,
    GroupLifecycleGroupVO group,
    Map<String, Long> activeCounts,
    Map<String, Long> historicalCounts,
    List<GroupLifecycleBlocker> blockers,
    LocalDateTime purgeEligibleAt,
    String snapshotHash
) {}
