package com.cwgsyw.platform.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AuditSnapshotSerializerTest {
    private final AuditSnapshotSerializer serializer = new AuditSnapshotSerializer(new ObjectMapper());

    @Test
    void redactsSensitiveFieldsAndProducesValidJson() throws Exception {
        String snapshot = serializer.serialize(Map.of(
                "name", "audit target", "password", "secret-value",
                "nested", Map.of("token", "secret-token")));

        assertThat(snapshot).contains("\"password\":\"[REDACTED]\"")
                .contains("\"token\":\"[REDACTED]\"")
                .doesNotContain("secret-value")
                .doesNotContain("secret-token");
        assertThat(new ObjectMapper().readTree(snapshot).isObject()).isTrue();
    }

    @Test
    void truncatesLargeTextAndCollections() {
        String snapshot = serializer.serialize(Map.of(
                "description", "x".repeat(600), "values", List.of("x".repeat(600))));

        assertThat(snapshot).contains("…");
    }

    @Test
    void sanitizesStoredJsonBeforeItIsReturnedToClients() {
        assertThat(serializer.sanitizeJson("{\"name\":\"target\",\"token\":\"legacy-secret\"}"))
                .isEqualTo("{\"name\":\"target\",\"token\":\"[REDACTED]\"}");
        assertThat(serializer.sanitizeJson("not-json")).isEqualTo("{}");
    }
}
