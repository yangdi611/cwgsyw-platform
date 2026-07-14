package com.cwgsyw.platform.module.authorization.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class AuthorizationMigrationExceptionVO {
    private Long id;
    private String runId;
    private String tenantId;
    private Long userId;
    private String username;
    private String realName;
    private String subjectType;
    private Long subjectId;
    private String subjectName;
    private String subjectCode;
    private Long activeSubjectUsers;
    private String resourceType;
    private Long resourceId;
    private String resourceName;
    private List<String> sourcePermissions;
    private Boolean sourceActive;
    private Boolean resourceActive;
    private Boolean canSystemCleanup;
    private Boolean canConvert;
    private String sourceType;
    private String sourceKey;
    private String reasonCode;
    private String resolutionStatus;
    private String resolutionNote;
    private Long resolvedBy;
    private String resolvedByName;
    private LocalDateTime resolvedAt;
    private LocalDateTime createdAt;
}
