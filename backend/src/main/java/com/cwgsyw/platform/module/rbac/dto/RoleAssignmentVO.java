package com.cwgsyw.platform.module.rbac.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class RoleAssignmentVO {
    private Long id;
    private Long roleId;
    private String roleName;
    private String roleCode;
    private String scopeType;
    private Long scopeId;
    private String scopeName;
    private LocalDateTime validUntil;
    private String originType;
}
