package com.cwgsyw.platform.module.authorization.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AuthorizationPreflightIssue {
    private String reasonCode;
    private Long userId;
    private String sourceKey;
    private String message;
}
