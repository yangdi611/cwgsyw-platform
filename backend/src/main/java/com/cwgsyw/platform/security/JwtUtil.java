package com.cwgsyw.platform.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
@Slf4j
public class JwtUtil {
    private final SecretKey key;
    private final long expiration;

    public JwtUtil(@Value("${jwt.secret}") String secret,
                   @Value("${jwt.expiration}") long expiration) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiration = expiration;
    }

    public String generateToken(Long userId, String username, String tenantId) {
        return Jwts.builder()
            .subject(username)
            .claim("userId", userId)
            .claim("tenantId", tenantId)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expiration * 1000))
            .signWith(key)
            .compact();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Invalid JWT: {}", e.getMessage());
            return false;
        }
    }

    private Claims claims(String token) {
        return Jwts.parser().verifyWith(key).build()
            .parseSignedClaims(token).getPayload();
    }

    public Long getUserId(String token)     { return claims(token).get("userId", Long.class); }
    public String getUsername(String token) { return claims(token).getSubject(); }
    public String getTenantId(String token) { return claims(token).get("tenantId", String.class); }
}
