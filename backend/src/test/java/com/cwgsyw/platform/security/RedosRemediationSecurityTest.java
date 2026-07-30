package com.cwgsyw.platform.security;

import com.cwgsyw.platform.config.SecurityProperties;
import com.cwgsyw.platform.module.ai.AiGatewayService;
import com.cwgsyw.platform.module.changedoc.ExportService;
import com.cwgsyw.platform.module.config.SysConfigController;
import com.cwgsyw.platform.module.config.SysConfigService;
import com.cwgsyw.platform.module.config.dto.PrometheusConfigRequest;
import com.cwgsyw.platform.module.user.password.PasswordPolicyService;
import com.cwgsyw.platform.module.user.password.PasswordPolicyViolation;
import com.cwgsyw.platform.module.wiki.WikiBacklinkMapper;
import com.cwgsyw.platform.module.wiki.WikiBacklinkService;
import com.cwgsyw.platform.module.wiki.WikiPageMapper;
import com.cwgsyw.platform.module.wiki.WikiPageService;
import com.cwgsyw.platform.module.wiki.entity.WikiBacklink;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class RedosRemediationSecurityTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(2);
    private static final int ATTACK_INPUT_LENGTH = 200_000;

    @Test
    void htmlStrippingPreservesFormattingAndHandlesUnterminatedTagsInLinearTime() {
        ExportService service = mock(ExportService.class, CALLS_REAL_METHODS);

        String formatted = ReflectionTestUtils.invokeMethod(
                service, "stripHtml", "<p>Hello<br />world</p>&amp;");
        assertThat(formatted).isEqualTo("Hello\nworld\n&");

        String attackInput = "<".repeat(ATTACK_INPUT_LENGTH);
        assertTimeoutPreemptively(TIMEOUT, () ->
                assertThat((String) ReflectionTestUtils.invokeMethod(service, "stripHtml", attackInput))
                        .isEqualTo(attackInput));
    }

    @Test
    void wikiBacklinkParsingPreservesAliasesAndHandlesUnterminatedLinksInLinearTime() {
        WikiBacklinkMapper backlinkMapper = mock(WikiBacklinkMapper.class);
        WikiPageMapper pageMapper = mock(WikiPageMapper.class);
        WikiBacklinkService service = new WikiBacklinkService(backlinkMapper, pageMapper);
        WikiPage target = new WikiPage();
        target.setId(42L);
        when(pageMapper.selectOne(any())).thenReturn(target);

        service.rebuild("default", 7L, "See [[ Target Page |label]] now");

        verify(backlinkMapper).insert(any(WikiBacklink.class));

        WikiBacklinkMapper attackBacklinkMapper = mock(WikiBacklinkMapper.class);
        WikiPageMapper attackPageMapper = mock(WikiPageMapper.class);
        WikiBacklinkService attackService = new WikiBacklinkService(attackBacklinkMapper, attackPageMapper);
        String attackInput = "[[" + "\\".repeat(ATTACK_INPUT_LENGTH);
        assertTimeoutPreemptively(TIMEOUT,
                () -> attackService.rebuild("default", 7L, attackInput));
        verifyNoInteractions(attackPageMapper);
    }

    @Test
    void wikiSlugGenerationHandlesLongSeparatorRunsInLinearTime() {
        WikiPageService service = mock(WikiPageService.class, CALLS_REAL_METHODS);
        String attackInput = "-".repeat(ATTACK_INPUT_LENGTH) + "Page";

        assertTimeoutPreemptively(TIMEOUT, () ->
                assertThat((String) ReflectionTestUtils.invokeMethod(service, "slugify", attackInput))
                        .isEqualTo("page"));
    }

    @Test
    void urlNormalizationHandlesLongTrailingSlashRunsInLinearTime() {
        AiGatewayService aiService = mock(AiGatewayService.class, CALLS_REAL_METHODS);
        String attackUrl = "https://example.test/v1" + "/".repeat(ATTACK_INPUT_LENGTH);

        assertTimeoutPreemptively(TIMEOUT, () ->
                assertThat((String) ReflectionTestUtils.invokeMethod(aiService, "normalizeBaseUrl", attackUrl))
                        .isEqualTo("https://example.test/v1"));

        SysConfigService configService = mock(SysConfigService.class);
        SysConfigController controller = new SysConfigController(configService);
        PrometheusConfigRequest request = new PrometheusConfigRequest();
        request.setUrl("http://127.0.0.1:9090" + "/".repeat(ATTACK_INPUT_LENGTH));

        assertTimeoutPreemptively(TIMEOUT, () -> controller.updatePrometheus(user(), request));
        verify(configService).set("default", "prometheus.url", "http://127.0.0.1:9090");
    }

    @Test
    void passwordInspectionHandlesLongRepeatedCharactersInLinearTime() {
        PasswordPolicyService service = new PasswordPolicyService(new SecurityProperties());
        String attackInput = "A".repeat(ATTACK_INPUT_LENGTH);

        assertTimeoutPreemptively(TIMEOUT, () -> {
            List<PasswordPolicyViolation> violations = service.inspect("operator", attackInput);
            assertThat(violations).contains(
                    PasswordPolicyViolation.MISSING_LOWER,
                    PasswordPolicyViolation.MISSING_DIGIT,
                    PasswordPolicyViolation.MISSING_SPECIAL);
        });
    }

    private SecurityUser user() {
        return new SecurityUser(1L, "security-test", "", "default", 1L, "platform", Set.of());
    }
}
