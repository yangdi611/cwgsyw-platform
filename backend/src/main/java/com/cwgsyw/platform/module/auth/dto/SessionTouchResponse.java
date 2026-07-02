package com.cwgsyw.platform.module.auth.dto;

import lombok.Data;

import java.time.LocalDateTime;

/** POST /api/auth/session/touch 响应（SPEC 11.1）。 */
@Data
public class SessionTouchResponse {
    private String sessionId;
    private LocalDateTime lastActiveAt;
    private LocalDateTime expiresAt;
}
