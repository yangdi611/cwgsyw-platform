package com.cwgsyw.platform.module.auth.session;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * Redis 中保存的可撤销会话记录（SPEC 10.3）。字段全部 camelCase，
 * 通过 Jackson 序列化为 JSON 字符串存入 {@code auth:session:{sessionId}}。
 */
@Data
public class AuthSessionRecord {
    private String sessionId;
    private Long userId;
    private String tenantId;
    private String username;
    private LocalDateTime createdAt;
    private LocalDateTime lastActiveAt;
    private LocalDateTime expiresAt;
    private Boolean revoked = false;
    private LocalDateTime revokedAt;
    private String revokedReason;
    private String userAgent;
    private String clientIp;
}
