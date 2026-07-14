package com.cwgsyw.platform.module.authorization.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AuthorizationCutoverStatusVO {
    private String configuredMode;
    private String effectiveMode;
    private String cutoverStatus;
    private Long cutoverEpoch;
    private LocalDateTime enforcedAt;
}
