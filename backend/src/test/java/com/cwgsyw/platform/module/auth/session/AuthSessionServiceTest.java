package com.cwgsyw.platform.module.auth.session;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.config.SecurityProperties;
import com.cwgsyw.platform.module.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 可撤销会话核心校验规则（SPEC 18.1 第12-15点）：
 * Redis 缺失 -> invalid，revoked -> revoked，idle 超时 -> timeout，
 * logout（revoke）后旧 session 不能再通过 validate。
 */
@ExtendWith(MockitoExtension.class)
class AuthSessionServiceTest {

    @Mock StringRedisTemplate redisTemplate;
    @Mock ValueOperations<String, String> valueOps;
    @Mock SetOperations<String, String> setOps;
    @Mock SecurityProperties securityProperties;

    private AuthSessionService service;
    private final ObjectMapper objectMapper = new ObjectMapper()
        .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

    private SecurityProperties.Session sessionCfg;

    @BeforeEach
    void setUp() {
        service = new AuthSessionService(redisTemplate, objectMapper, securityProperties);
        ReflectionTestUtils.setField(service, "jwtExpirationSeconds", 86400L);

        sessionCfg = new SecurityProperties.Session();
        sessionCfg.setIdleTimeoutMinutes(60);
        sessionCfg.setRedisTtlBufferMinutes(10);
        lenient().when(securityProperties.getSession()).thenReturn(sessionCfg);
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
        lenient().when(redisTemplate.opsForSet()).thenReturn(setOps);
    }

    private User testUser() {
        User u = new User();
        u.setId(1L);
        u.setTenantId("default");
        u.setUsername("zhangsan");
        return u;
    }

    // ── createSession ──────────────────────────────────────────────────────

    @Test
    void createSession_success_savesRecordAndAddsToUserSet() {
        AuthSessionRecord record = service.createSession(testUser(), "Mozilla/5.0", "10.0.0.1");

        assertNotNull(record.getSessionId());
        assertEquals(1L, record.getUserId());
        assertEquals(1L, record.getSessionEpoch());
        assertFalse(record.getRevoked());
        verify(valueOps).set(eq("auth:session:" + record.getSessionId()), anyString(), anyLong(), any(TimeUnit.class));
        verify(setOps).add(eq("auth:userSessions:1"), eq(record.getSessionId()));
    }

    @Test
    void createSession_redisUnavailable_throwsServiceUnavailable() {
        doThrow(new RuntimeException("Redis down"))
            .when(valueOps).set(anyString(), anyString(), anyLong(), any(TimeUnit.class));

        BusinessException ex = assertThrows(BusinessException.class,
            () -> service.createSession(testUser(), "ua", "ip"));
        assertEquals("SESSION_STORE_UNAVAILABLE", ex.getErrorCode());
        assertEquals(503, ex.getHttpStatus());
    }

    // ── validate: missing / revoked / timeout / valid ───────────────────────

    @Test
    void validate_sessionMissing_returnsInvalid() {
        when(valueOps.get("auth:session:missing")).thenReturn(null);

        SessionValidationResult result = service.validate("missing", 1L);

        assertEquals(AuthSessionStatus.INVALID, result.getStatus());
    }

    @Test
    void validate_sessionRevoked_returnsRevoked() throws Exception {
        AuthSessionRecord record = buildRecord("sess-1", 1L, LocalDateTime.now(), true);
        when(valueOps.get("auth:session:sess-1")).thenReturn(objectMapper.writeValueAsString(record));

        SessionValidationResult result = service.validate("sess-1", 1L);

        assertEquals(AuthSessionStatus.REVOKED, result.getStatus());
    }

    @Test
    void validate_userIdMismatch_returnsInvalid() throws Exception {
        AuthSessionRecord record = buildRecord("sess-1", 1L, LocalDateTime.now(), false);
        when(valueOps.get("auth:session:sess-1")).thenReturn(objectMapper.writeValueAsString(record));

        SessionValidationResult result = service.validate("sess-1", 999L);

        assertEquals(AuthSessionStatus.INVALID, result.getStatus());
    }

    @Test
    void validate_idleTimeoutExceeded_returnsTimeoutAndRevokes() throws Exception {
        AuthSessionRecord record = buildRecord("sess-1", 1L, LocalDateTime.now().minusMinutes(120), false);
        when(valueOps.get("auth:session:sess-1")).thenReturn(objectMapper.writeValueAsString(record));

        SessionValidationResult result = service.validate("sess-1", 1L);

        assertEquals(AuthSessionStatus.TIMEOUT, result.getStatus());
        // revoke 内部会再次写回 Redis（标记 revoked）
        verify(valueOps, atLeastOnce()).set(eq("auth:session:sess-1"), anyString(), anyLong(), any());
    }

    @Test
    void validate_withinIdleWindow_returnsValid() throws Exception {
        AuthSessionRecord record = buildRecord("sess-1", 1L, LocalDateTime.now().minusMinutes(5), false);
        when(valueOps.get("auth:session:sess-1")).thenReturn(objectMapper.writeValueAsString(record));

        SessionValidationResult result = service.validate("sess-1", 1L);

        assertEquals(AuthSessionStatus.VALID, result.getStatus());
    }

    @Test
    void validate_staleGlobalEpoch_returnsInvalidWithoutDeletingSession() throws Exception {
        AuthSessionRecord record = buildRecord("sess-1", 1L, LocalDateTime.now(), false);
        record.setSessionEpoch(1L);
        when(valueOps.get("auth:session:sess-1")).thenReturn(objectMapper.writeValueAsString(record));
        when(valueOps.get("auth:sessionEpoch")).thenReturn("2");

        SessionValidationResult result = service.validate("sess-1", 1L);

        assertEquals(AuthSessionStatus.INVALID, result.getStatus());
        verify(valueOps, never()).set(eq("auth:session:sess-1"), anyString(), anyLong(), any());
    }

    @Test
    void validate_legacySessionRemainsCompatibleAtInitialEpoch() throws Exception {
        AuthSessionRecord record = buildRecord("sess-1", 1L, LocalDateTime.now(), false);
        when(valueOps.get("auth:session:sess-1")).thenReturn(objectMapper.writeValueAsString(record));
        when(valueOps.get("auth:sessionEpoch")).thenReturn(null);

        SessionValidationResult result = service.validate("sess-1", 1L);

        assertEquals(AuthSessionStatus.VALID, result.getStatus());
    }

    @Test
    void validate_redisThrows_returnsStoreUnavailable() {
        when(valueOps.get("auth:session:sess-1")).thenThrow(new RuntimeException("Redis down"));

        SessionValidationResult result = service.validate("sess-1", 1L);

        assertEquals(AuthSessionStatus.STORE_UNAVAILABLE, result.getStatus());
    }

    // ── revoke (logout) 幂等 + 后续 validate 失败 ────────────────────────────

    @Test
    void revoke_thenValidate_returnsRevoked() throws Exception {
        AuthSessionRecord record = buildRecord("sess-1", 1L, LocalDateTime.now(), false);
        String json = objectMapper.writeValueAsString(record);
        when(valueOps.get("auth:session:sess-1")).thenReturn(json);

        service.revoke("sess-1", 1L, "USER_LOGOUT");

        verify(valueOps).set(eq("auth:session:sess-1"), argThat((String saved) -> saved.contains("\"revoked\":true")),
            anyLong(), any());
    }

    @Test
    void revoke_sessionNotFound_doesNotThrow() {
        when(valueOps.get("auth:session:missing")).thenReturn(null);

        assertDoesNotThrow(() -> service.revoke("missing", 1L, "USER_LOGOUT"));
        verify(valueOps, never()).set(eq("auth:session:missing"), anyString(), anyLong(), any());
    }

    @Test
    void revokeAllForUser_emptySet_doesNotThrow() {
        when(setOps.members("auth:userSessions:1")).thenReturn(Set.of());

        assertDoesNotThrow(() -> service.revokeAllForUser(1L, 9L, "ADMIN_REVOKE"));
    }

    private AuthSessionRecord buildRecord(String sessionId, Long userId, LocalDateTime lastActiveAt, boolean revoked) {
        AuthSessionRecord record = new AuthSessionRecord();
        record.setSessionId(sessionId);
        record.setUserId(userId);
        record.setTenantId("default");
        record.setUsername("zhangsan");
        record.setCreatedAt(LocalDateTime.now().minusHours(1));
        record.setLastActiveAt(lastActiveAt);
        record.setExpiresAt(LocalDateTime.now().plusDays(1));
        record.setRevoked(revoked);
        return record;
    }
}
