package com.cwgsyw.platform.common;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AuditRemarkTest {
    @Test
    void boundedPreservesNullAndBoundaryValues() {
        assertThat(AuditRemark.bounded(null)).isNull();
        assertThat(AuditRemark.bounded("界".repeat(512))).isEqualTo("界".repeat(512));
    }

    @Test
    void boundedProducesUnicodeSafe512CodePointSummary() {
        String value = "审批🙂".repeat(300);

        String result = AuditRemark.bounded(value);

        assertThat(result.codePointCount(0, result.length())).isEqualTo(512);
        assertThat(result).endsWith("...");
        assertThat(result).doesNotContain("�");
    }
}
