package com.cwgsyw.platform.module.org.dto;

import lombok.Data;

@Data
public class UserGroupMembershipVO {
    private Long id;
    private Long groupId;
    private String groupName;
    private String membershipRole;
    private Boolean primary;
    private String originType;
}
