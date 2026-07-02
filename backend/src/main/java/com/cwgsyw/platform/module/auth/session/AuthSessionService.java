package com.cwgsyw.platform.module.auth.session;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.SecurityErrorCode;
import com.cwgsyw.platform.config.SecurityProperties;
import com.cwgsyw.platform.module.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * JWT 之外的服务端可撤销会话（SPEC 10.4）。Redis 是认证链路的强依赖：
 * 不可用时登录和请求校验都必须安全失败（503），不允许默认放行。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthSessionService {

    private static final String SESSION_KEY_PREFIX = "auth:session:";
    private static final String USER_SESSIONS_KEY_PREFIX = "auth:userSessions:";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final SecurityProperties securityProperties;

    @Value("${jwt.expiration}")
    private long jwtExpirationSeconds;

    public AuthSessionRecord createSession(User user, String userAgent, String clientIp) {
        String sessionId = UUID.randomUUID().toString().replace("-", "");
        LocalDateTime now = LocalDateTime.now();

        AuthSessionRecord record = new AuthSessionRecord();
        record.setSessionId(sessionId);
        record.setUserId(user.getId());
        record.setTenantId(user.getTenantId());
        record.setUsername(user.getUsername());
        record.setCreatedAt(now);
        record.setLastActiveAt(now);
        record.setExpiresAt(now.plusSeconds(jwtExpirationSeconds));
        record.setRevoked(false);
        record.setUserAgent(userAgent);
        record.setClientIp(clientIp);

        try {
            saveRecord(record);
            redisTemplate.opsForSet().add(userSessionsKey(user.getId()), sessionId);
            redisTemplate.expire(userSessionsKey(user.getId()), ttlDuration(), TimeUnit.SECONDS);
        } catch (Exception e) {
            log.error("创建 Redis 会话失败: userId={}", user.getId(), e);
            throw new BusinessException(503, SecurityErrorCode.SESSION_STORE_UNAVAILABLE, "系统认证服务暂不可用，请稍后重试");
        }
        return record;
    }

    public SessionValidationResult validate(String sessionId, Long userId) {
        AuthSessionRecord record;
        try {
            record = loadRecord(sessionId);
        } catch (Exception e) {
            log.error("校验 Redis 会话失败: sessionId={}", sessionId, e);
            return SessionValidationResult.of(AuthSessionStatus.STORE_UNAVAILABLE, null);
        }

        if (record == null) {
            return SessionValidationResult.of(AuthSessionStatus.INVALID, null);
        }
        if (!record.getUserId().equals(userId)) {
            return SessionValidationResult.of(AuthSessionStatus.INVALID, record);
        }
        if (Boolean.TRUE.equals(record.getRevoked())) {
            return SessionValidationResult.of(AuthSessionStatus.REVOKED, record);
        }

        long idleMinutes = ChronoUnit.MINUTES.between(record.getLastActiveAt(), LocalDateTime.now());
        if (idleMinutes > securityProperties.getSession().getIdleTimeoutMinutes()) {
            revoke(sessionId, null, "SESSION_TIMEOUT");
            return SessionValidationResult.of(AuthSessionStatus.TIMEOUT, record);
        }

        return SessionValidationResult.of(AuthSessionStatus.VALID, record);
    }

    public void touch(String sessionId, Long userId) {
        AuthSessionRecord record;
        try {
            record = loadRecord(sessionId);
        } catch (Exception e) {
            log.error("touch 会话失败: sessionId={}", sessionId, e);
            throw new BusinessException(503, SecurityErrorCode.SESSION_STORE_UNAVAILABLE, "系统认证服务暂不可用，请稍后重试");
        }
        if (record == null || !record.getUserId().equals(userId) || Boolean.TRUE.equals(record.getRevoked())) {
            throw new BusinessException(401, SecurityErrorCode.SESSION_INVALID, "登录状态已失效，请重新登录");
        }
        record.setLastActiveAt(LocalDateTime.now());
        saveRecord(record);
    }

    /** 幂等：session 不存在时不报错，直接视为已撤销。 */
    public void revoke(String sessionId, Long operatorId, String reason) {
        if (sessionId == null) return;
        AuthSessionRecord record;
        try {
            record = loadRecord(sessionId);
        } catch (Exception e) {
            log.warn("撤销会话时读取 Redis 失败，忽略: sessionId={}", sessionId, e);
            return;
        }
        if (record == null) return;
        record.setRevoked(true);
        record.setRevokedAt(LocalDateTime.now());
        record.setRevokedReason(reason);
        saveRecord(record);
    }

    /** 幂等：用户 session 集合为空时直接成功返回。 */
    public void revokeAllForUser(Long userId, Long operatorId, String reason) {
        Set<String> sessionIds = redisTemplate.opsForSet().members(userSessionsKey(userId));
        if (sessionIds == null || sessionIds.isEmpty()) return;
        for (String sessionId : sessionIds) {
            revoke(sessionId, operatorId, reason);
        }
    }

    public List<AuthSessionRecord> listUserSessions(Long userId) {
        Set<String> sessionIds = redisTemplate.opsForSet().members(userSessionsKey(userId));
        if (sessionIds == null || sessionIds.isEmpty()) return List.of();
        Set<AuthSessionRecord> records = new HashSet<>();
        for (String sessionId : sessionIds) {
            AuthSessionRecord record = loadRecord(sessionId);
            if (record != null) records.add(record);
        }
        return records.stream()
            .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
            .collect(Collectors.toList());
    }

    private void saveRecord(AuthSessionRecord record) {
        try {
            String json = objectMapper.writeValueAsString(record);
            redisTemplate.opsForValue().set(sessionKey(record.getSessionId()), json, ttlDuration(), TimeUnit.SECONDS);
        } catch (Exception e) {
            throw new IllegalStateException("序列化会话记录失败", e);
        }
    }

    private AuthSessionRecord loadRecord(String sessionId) {
        String json = redisTemplate.opsForValue().get(sessionKey(sessionId));
        if (json == null) return null;
        try {
            return objectMapper.readValue(json, AuthSessionRecord.class);
        } catch (Exception e) {
            throw new IllegalStateException("反序列化会话记录失败", e);
        }
    }

    private long ttlDuration() {
        return jwtExpirationSeconds + securityProperties.getSession().getRedisTtlBufferMinutes() * 60;
    }

    private String sessionKey(String sessionId) {
        return SESSION_KEY_PREFIX + sessionId;
    }

    private String userSessionsKey(Long userId) {
        return USER_SESSIONS_KEY_PREFIX + userId;
    }
}
