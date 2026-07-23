package com.cwgsyw.platform.module.task.plan.dto;

import java.util.List;

public record CiScopeResolution(
    List<CiScopeSelection> selections,
    long total,
    boolean truncated,
    List<ResolvedCiInstance> instances,
    List<String> warnings
) {
}
