package com.cwgsyw.platform.module.authorization.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder(toBuilder = true)
public class RoleAclConversionResult {
    private Long sourceRoleId;
    private String resourceType;
    private Long resourceId;
    private String targetSubjectType;
    private Long targetSubjectId;
    private long legacyAclEntries;
    private long resourceAclEntries;
    private long resolvedExceptions;
}
