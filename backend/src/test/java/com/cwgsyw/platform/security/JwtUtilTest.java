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
        String token = jwtUtil.generateToken(1L, "testuser", "default");
        assertThat(token).isNotBlank();
        assertThat(jwtUtil.validateToken(token)).isTrue();
        assertThat(jwtUtil.getUserId(token)).isEqualTo(1L);
        assertThat(jwtUtil.getUsername(token)).isEqualTo("testuser");
        assertThat(jwtUtil.getTenantId(token)).isEqualTo("default");
    }

    @Test
    void expiredTokenIsInvalid() {
        JwtUtil shortLived = new JwtUtil(
            "test_secret_must_be_256bits_long_at_least_padding_padding_ok", 0L);
        String token = shortLived.generateToken(1L, "u", "default");
        assertThat(shortLived.validateToken(token)).isFalse();
    }

    @Test
    void invalidTokenReturnsFalse() {
        assertThat(jwtUtil.validateToken("not.a.valid.token")).isFalse();
    }
}
