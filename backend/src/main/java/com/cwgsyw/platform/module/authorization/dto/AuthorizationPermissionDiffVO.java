package com.cwgsyw.platform.module.authorization.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AuthorizationPermissionDiffVO {
    private Long userId;
    private String username;
    private String realName;
    private String permissionCode;
    private String permissionName;
    private boolean legacyAllowed;
    private boolean assignmentAllowed;
    private List<AuthorizationPermissionSourceVO> legacySources;
    private List<AuthorizationPermissionSourceVO> assignmentSources;
}
