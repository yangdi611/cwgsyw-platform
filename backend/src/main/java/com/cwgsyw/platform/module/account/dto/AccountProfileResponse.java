package com.cwgsyw.platform.module.account.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/** SPEC 8.3。字段全部 camelCase。 */
@Data
public class AccountProfileResponse {
    private Long id;
    private String username;
    private String realName;
    private String email;
    private String phone;
    private String avatarUrl;
    private Boolean mustChangePassword;
    private Boolean profileCompleted;
    private LocalDateTime passwordChangedAt;
    private LocalDateTime lastLoginAt;
    private List<String> requiredActions;
}
