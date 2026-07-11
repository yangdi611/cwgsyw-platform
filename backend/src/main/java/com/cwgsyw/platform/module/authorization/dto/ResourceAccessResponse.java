package com.cwgsyw.platform.module.authorization.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ResourceAccessResponse {
    private Long ownerUserId;
    private Long ownerGroupId;
    private Long version;
    private String mode;
    private List<ResourceAclEntryResponse> entries;
    private List<ResourceAclEntryResponse> defaultEntries;

    @Data
    @Builder
    public static class ResourceAclEntryResponse {
        private String entryType;
        private String subjectType;
        private Long subjectId;
        private String permissions;
    }
}
