package com.cwgsyw.platform.module.authorization.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class PendingAuthorizationUserVO {
    private Long userId;
    private String username;
    private String realName;
    private Integer status;
    private Long primaryGroupId;
    private String primaryGroupName;
    private List<String> reasonCodes;
}
