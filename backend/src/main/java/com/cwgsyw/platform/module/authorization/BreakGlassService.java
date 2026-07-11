package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.config.AuthorizationProperties;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class BreakGlassService {
    private static final String KEY_PREFIX = "authorization:break-glass:";

    private final StringRedisTemplate redisTemplate;
    private final AuthorizationProperties properties;
    private final AuditLogMapper auditLogMapper;

    public void activate(SecurityUser user, String reason) {
        requirePlatformSession(user);
        redisTemplate.opsForValue().set(key(user), reason,
            properties.getBreakGlassTtlMinutes(), TimeUnit.MINUTES);
        auditLogMapper.insert(AuditLog.builder().tenantId(user.getTenantId()).module("authorization")
            .action("break_glass_activate").targetId(user.getUserId()).targetType("session")
            .operatorId(user.getUserId()).remark(reason).createdAt(LocalDateTime.now()).build());
    }

    public void deactivate(SecurityUser user) {
        requirePlatformSession(user);
        redisTemplate.delete(key(user));
        auditLogMapper.insert(AuditLog.builder().tenantId(user.getTenantId()).module("authorization")
            .action("break_glass_deactivate").targetId(user.getUserId()).targetType("session")
            .operatorId(user.getUserId()).createdAt(LocalDateTime.now()).build());
    }

    public boolean isActive(SecurityUser user) {
        if (!"platform".equals(user.getGroupScope()) || user.getSessionId() == null) return false;
        return Boolean.TRUE.equals(redisTemplate.hasKey(key(user)));
    }

    public void auditBypass(SecurityUser user, String permissionCode, String resourceType, Long resourceId,
                            String ordinaryReason) {
        String reason = redisTemplate.opsForValue().get(key(user));
        auditLogMapper.insert(AuditLog.builder().tenantId(user.getTenantId()).module("authorization")
            .action("break_glass_bypass").targetId(resourceId).targetType(resourceType)
            .operatorId(user.getUserId()).remark("permission=" + permissionCode + "; denied="
                + ordinaryReason + "; reason=" + reason).createdAt(LocalDateTime.now()).build());
    }

    private void requirePlatformSession(SecurityUser user) {
        if (!"platform".equals(user.getGroupScope()) || user.getSessionId() == null) {
            throw new AccessDeniedException("仅超级管理员的有效会话可以激活 break-glass");
        }
    }

    private String key(SecurityUser user) {
        return KEY_PREFIX + user.getUserId() + ":" + user.getSessionId();
    }
}
