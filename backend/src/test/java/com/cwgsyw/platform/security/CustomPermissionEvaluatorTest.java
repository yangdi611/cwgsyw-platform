package com.cwgsyw.platform.security;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import static org.assertj.core.api.Assertions.assertThat;

class CustomPermissionEvaluatorTest {
    private final CustomPermissionEvaluator evaluator = new CustomPermissionEvaluator();

    @Test
    void legacyCmdbModelWriteGrantsCanonicalUpdate() {
        SecurityUser user = new SecurityUser(1L, "legacy", "", "default", 1L, "group",
                Set.of("cmdb_model:write"));

        assertThat(evaluator.hasPermission(authentication(user), "cmdb_model", "update")).isTrue();
        assertThat(evaluator.hasPermission(authentication(user), "cmdb_model", "delete")).isFalse();
    }

    @Test
    void canonicalUpdateDoesNotGrantDeprecatedWrite() {
        SecurityUser user = new SecurityUser(1L, "canonical", "", "default", 1L, "group",
                Set.of("cmdb_model:update"));

        assertThat(evaluator.hasPermission(authentication(user), "cmdb_model", "write")).isFalse();
    }

    private UsernamePasswordAuthenticationToken authentication(SecurityUser user) {
        return new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
    }
}
