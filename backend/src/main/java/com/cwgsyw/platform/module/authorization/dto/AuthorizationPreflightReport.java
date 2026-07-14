package com.cwgsyw.platform.module.authorization.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class AuthorizationPreflightReport {
    private boolean eligible;
    private Map<String, Long> counts;
    private List<AuthorizationPreflightIssue> issues;
    @Builder.Default
    private List<AuthorizationPermissionDiffVO> permissionDiffs = List.of();
}
