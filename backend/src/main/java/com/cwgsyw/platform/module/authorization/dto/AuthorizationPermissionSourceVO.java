package com.cwgsyw.platform.module.authorization.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthorizationPermissionSourceVO {
    private Long roleId;
    private String roleCode;
    private String roleName;
    private Long assignmentId;
    private String scopeType;
    private Long scopeId;
    private String scopeName;
    private String originType;
}
