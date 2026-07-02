package com.cwgsyw.platform.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class JwtUtilTest {
    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil(
            "test_secret_must_be_256bits_long_at_least_padding_padding_ok",
            86400L
        );
    }

    @Test
    void generateAndValidateToken() {
        String token = jwtUtil.generateToken(1L, "testuser", "default", "session-abc");
        assertThat(token).isNotBlank();
        assertThat(jwtUtil.validateToken(token)).isTrue();
        assertThat(jwtUtil.getUserId(token)).isEqualTo(1L);
        assertThat(jwtUtil.getUsername(token)).isEqualTo("testuser");
        assertThat(jwtUtil.getTenantId(token)).isEqualTo("default");
        assertThat(jwtUtil.getSessionId(token)).isEqualTo("session-abc");
    }

    @Test
    void expiredTokenIsInvalid() {
        JwtUtil shortLived = new JwtUtil(
            "test_secret_must_be_256bits_long_at_least_padding_padding_ok", 0L);
        String token = shortLived.generateToken(1L, "u", "default", "session-abc");
        assertThat(shortLived.validateToken(token)).isFalse();
    }

    @Test
    void invalidTokenReturnsFalse() {
        assertThat(jwtUtil.validateToken("not.a.valid.token")).isFalse();
    }

    @Test
    void tokenWithoutSessionIdReturnsNullSessionId() {
        // 模拟旧 token（升级前签发，不含 sessionId claim）：JwtAuthFilter 应将其视为无效会话
        JwtUtil legacyStyle = new JwtUtil(
            "test_secret_must_be_256bits_long_at_least_padding_padding_ok", 86400L);
        String token = io.jsonwebtoken.Jwts.builder()
            .subject("legacyuser")
            .claim("userId", 1L)
            .claim("tenantId", "default")
            .issuedAt(new java.util.Date())
            .expiration(new java.util.Date(System.currentTimeMillis() + 86400_000L))
            .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(
                "test_secret_must_be_256bits_long_at_least_padding_padding_ok".getBytes()))
            .compact();
        assertThat(legacyStyle.validateToken(token)).isTrue();
        assertThat(legacyStyle.getSessionId(token)).isNull();
    }
}
