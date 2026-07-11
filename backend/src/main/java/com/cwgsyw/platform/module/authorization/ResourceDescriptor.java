package com.cwgsyw.platform.module.authorization;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ResourceDescriptor {
    private String tenantId;
    private String resourceType;
    private Long resourceId;
    private Long ownerUserId;
    private Long ownerGroupId;
    private Integer permissionMode;
    private Long accessVersion;
    private Long parentId;
}
