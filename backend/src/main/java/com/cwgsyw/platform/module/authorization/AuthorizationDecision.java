package com.cwgsyw.platform.module.authorization;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthorizationDecision {
    private boolean allowed;
    private String reasonCode;
    private Long matchedRoleAssignmentId;
    private String matchedScopeType;
    private Long matchedScopeId;
    private String resourceClass;
    private int effectivePermissions;
}
