package com.cwgsyw.platform.module.report;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportControllerTest {
    @Mock ReportExportService reportExportService;
    @Mock AuditLogMapper auditLogMapper;
    @InjectMocks ReportController controller;

    @Test
    void groupScope_forcesOwnGroupAndAuditsEffectiveScope() {
        SecurityUser user = user("group", 12L);
        when(reportExportService.exportExcel("default", "2026-07-01", "2026-07-31", 12L))
                .thenReturn(new byte[] {1, 2});

        var result = controller.export("2026-07-01", "2026-07-31", null, user);

        assertThat(result.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(result.getHeaders().getContentDisposition().getFilename())
                .isEqualTo("日报汇总_2026-07-01_2026-07-31.xlsx");
        assertThat(result.getHeaders().getContentDisposition().getCharset())
                .isEqualTo(java.nio.charset.StandardCharsets.UTF_8);
        verify(reportExportService).exportExcel("default", "2026-07-01", "2026-07-31", 12L);
        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(audit.capture());
        assertThat(audit.getValue().getAction()).isEqualTo("export");
        assertThat(audit.getValue().getAfterJson()).contains("\"groupId\":12");
    }

    @Test
    void groupScope_rejectsOtherGroupWithoutExportOrAudit() {
        SecurityUser user = user("group", 12L);

        assertThatThrownBy(() -> controller.export("2026-07-01", "2026-07-31", 99L, user))
                .isInstanceOf(AccessDeniedException.class);
        verify(reportExportService, org.mockito.Mockito.never()).exportExcel(any(), any(), any(), any());
        verify(auditLogMapper, org.mockito.Mockito.never()).insert(org.mockito.ArgumentMatchers.<AuditLog>any());
    }

    @Test
    void tenantScope_honorsRequestedGroup() {
        SecurityUser user = user("tenant", null);
        when(reportExportService.exportExcel("default", "2026-07-01", "2026-07-31", 99L))
                .thenReturn(new byte[] {1});

        controller.export("2026-07-01", "2026-07-31", 99L, user);

        verify(reportExportService).exportExcel("default", "2026-07-01", "2026-07-31", 99L);
    }

    @Test
    void invalidOrReversedDates_areStableBadRequestsBeforeSideEffects() {
        SecurityUser user = user("platform", null);

        assertThatIllegalArgumentException().isThrownBy(
                () -> controller.export("not-a-date", "2026-07-31", null, user));
        assertThatIllegalArgumentException().isThrownBy(
                () -> controller.export("2026-07-31", "2026-07-01", null, user));
        verify(reportExportService, org.mockito.Mockito.never()).exportExcel(any(), any(), any(), any());
        verify(auditLogMapper, org.mockito.Mockito.never()).insert(org.mockito.ArgumentMatchers.<AuditLog>any());
    }

    private SecurityUser user(String scope, Long groupId) {
        return new SecurityUser(7L, "exporter", "ignored", "default", groupId, scope,
                Set.of("daily_report:export"));
    }
}
