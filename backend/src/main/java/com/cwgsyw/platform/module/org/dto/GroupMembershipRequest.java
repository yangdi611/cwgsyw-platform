package com.cwgsyw.platform.module.org.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class GroupMembershipRequest {
    @NotNull
    private Long groupId;

    @Pattern(regexp = "leader|member", message = "membershipRole must be leader or member")
    private String membershipRole = "member";

    private Boolean primary = false;
}
