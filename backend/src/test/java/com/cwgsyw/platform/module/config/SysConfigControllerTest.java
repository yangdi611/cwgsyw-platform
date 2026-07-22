package com.cwgsyw.platform.module.config;

import com.cwgsyw.platform.security.SecurityUser;
import com.cwgsyw.platform.module.config.dto.NotificationConfigRequest;
import com.cwgsyw.platform.module.config.dto.PrometheusConfigRequest;
import com.cwgsyw.platform.module.config.dto.SmtpConfigRequest;
import com.cwgsyw.platform.module.config.dto.WatermarkConfigRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SysConfigControllerTest {
    @Mock private SysConfigService configService;
    @Mock private NotificationConfigService notificationConfigService;
    @InjectMocks private SysConfigController controller;

    @Test
    void unsupportedKey_isBadRequestBeforeAnyWrite() {
        assertThatIllegalArgumentException().isThrownBy(
                () -> controller.updateGeneric(user(), Map.of("unsupported", "value")));

        verify(configService, never()).set(any(), any(), any());
    }

    @Test
    void emptyRequest_isBadRequestBeforeAnyWrite() {
        assertThatIllegalArgumentException().isThrownBy(
                () -> controller.updateGeneric(user(), Map.of()));

        verify(configService, never()).set(any(), any(), any());
    }

    @Test
    void nonStringValue_isBadRequestBeforeAnyWrite() {
        assertThatIllegalArgumentException().isThrownBy(
                () -> controller.updateGeneric(user(), Map.of("daily_report_process_definition_id", 42)));

        verify(configService, never()).set(any(), any(), any());
    }

    @Test
    void allowedStringValue_isWritten() {
        controller.updateGeneric(user(), Map.of("daily_report_process_definition_id", "definition-id"));

        verify(configService).set(eq("default"), eq("daily_report_process_definition_id"), eq("definition-id"));
    }

    @Test
    void smtpUpdates_useSharedConfigurationWritePath() {
        SmtpConfigRequest request = new SmtpConfigRequest();
        request.setHost("mail.example.test");
        request.setPort(2525);

        controller.updateSmtp(user(), request);

        verify(configService).set("default", "smtp.host", "mail.example.test");
        verify(configService).set("default", "smtp.port", "2525");
    }

    @Test
    void notificationUpdates_useSharedConfigurationWritePath() {
        NotificationConfigRequest request = new NotificationConfigRequest();
        request.setReminderCron("0 0 9 * * ?");

        controller.updateNotification(user(), request);

        verify(notificationConfigService).update(any(SecurityUser.class), eq(request));
    }

    @Test
    void watermarkUpdates_useSharedConfigurationWritePath() {
        WatermarkConfigRequest request = new WatermarkConfigRequest();
        request.setEnabled(true);
        request.setOpacity(0.5D);
        request.setAngle(-30);

        controller.updateWatermark(user(), request);

        verify(configService).set("default", "watermark.enabled", "true");
        verify(configService).set("default", "watermark.opacity", "0.5");
        verify(configService).set("default", "watermark.angle", "-30");
    }

    @Test
    void prometheusUpdates_useSharedConfigurationWritePathAndNormalizeUrl() {
        PrometheusConfigRequest request = new PrometheusConfigRequest();
        request.setEnabled(false);
        request.setUrl("http://127.0.0.1:9090/");
        request.setScrapeInterval(60);

        controller.updatePrometheus(user(), request);

        verify(configService).set("default", "prometheus.enabled", "false");
        verify(configService).set("default", "prometheus.url", "http://127.0.0.1:9090");
        verify(configService).set("default", "prometheus.scrape_interval", "60");
    }

    @Test
    void invalidPrometheusUrl_isRejectedBeforeAnyWrite() {
        PrometheusConfigRequest request = new PrometheusConfigRequest();
        request.setUrl("ftp://prometheus.example.test");

        assertThatIllegalArgumentException().isThrownBy(() -> controller.updatePrometheus(user(), request));

        verify(configService, never()).set(any(), any(), any());
    }

    private SecurityUser user() {
        return new SecurityUser(1L, "config-admin", "", "default", 1L, "platform",
                Set.of("workflow:configure"));
    }
}
