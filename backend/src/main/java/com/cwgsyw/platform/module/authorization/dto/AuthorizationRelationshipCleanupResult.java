package com.cwgsyw.platform.module.authorization.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder(toBuilder = true)
public class AuthorizationRelationshipCleanupResult {
    private long roleAssignments;
    private long groupMemberships;
    private long groupLeaderships;
    private long resourceAclEntries;
    private long totalRelationships;
}
