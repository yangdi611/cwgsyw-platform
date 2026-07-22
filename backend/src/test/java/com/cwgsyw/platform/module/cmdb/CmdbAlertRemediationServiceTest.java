package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.alert.CmdbAlertMapper;
import com.cwgsyw.platform.module.cmdb.alert.CmdbAlertRemediationService;
import com.cwgsyw.platform.module.cmdb.alert.entity.CmdbAlert;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.Mockito.*;

class CmdbAlertRemediationServiceTest {
    private final CmdbAlertMapper alertMapper = mock(CmdbAlertMapper.class);
    private final AuditLogMapper auditLogMapper = mock(AuditLogMapper.class);
    private final CmdbAlertRemediationService service =
            new CmdbAlertRemediationService(alertMapper, auditLogMapper);
    private final String runId = "FQA_20260718_2050_remp1038_alert_123";
    private CmdbAlert alert;

    @BeforeEach
    void setUp() {
        alert = new CmdbAlert();
        alert.setId(42L);
        alert.setTenantId("default");
        alert.setAlertName(runId);
        alert.setRawLabels("{\"run_id\":\"" + runId + "\"}");
    }

    @Test
    void rejectsNonPlatformUserBeforeLoadingAlert() {
        assertThatIllegalArgumentException().isThrownBy(() ->
                service.purgeRemediationTest(user("group", "default"), 42L, runId));

        verifyNoInteractions(alertMapper, auditLogMapper);
    }

    @Test
    void rejectsBlankRunIdBeforeLoadingAlert() {
        assertThatIllegalArgumentException().isThrownBy(() ->
                service.purgeRemediationTest(user("platform", "default"), 42L, " "));

        verifyNoInteractions(alertMapper, auditLogMapper);
    }

    @Test
    void rejectsCrossTenantAndUnmarkedAlertsWithoutWrites() {
        when(alertMapper.selectById(42L)).thenReturn(alert);

        assertThatIllegalArgumentException().isThrownBy(() ->
                service.purgeRemediationTest(user("platform", "other"), 42L, runId));
        assertThatIllegalArgumentException().isThrownBy(() ->
                service.purgeRemediationTest(user("platform", "default"), 42L, runId + "_wrong"));

        verify(alertMapper, never()).updateById(any(CmdbAlert.class));
        verify(alertMapper, never()).deleteById(anyLong());
        verifyNoInteractions(auditLogMapper);
    }

    @Test
    void softDeletesExactRunIdAlertAndAudits() {
        when(alertMapper.selectById(42L)).thenReturn(alert);

        service.purgeRemediationTest(user("platform", "default"), 42L, runId);

        assertThat(alert.getDeletedAt()).isNotNull();
        assertThat(alert.getDeletedBy()).isEqualTo(7L);
        assertThat(alert.getUpdatedBy()).isEqualTo(7L);
        verify(alertMapper).updateById(alert);
        verify(alertMapper).deleteById(42L);
        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(audit.capture());
        assertThat(audit.getValue().getAction()).isEqualTo("purge_remediation_test");
        assertThat(audit.getValue().getTargetType()).isEqualTo("cmdb_alert");
        assertThat(audit.getValue().getTargetId()).isEqualTo(42L);
        assertThat(audit.getValue().getOperatorId()).isEqualTo(7L);
        assertThat(audit.getValue().getRemark()).isEqualTo("remediationRunId=" + runId);
    }

    @Test
    void rejectsDuplicateCleanupWithoutAudit() {
        when(alertMapper.selectById(42L)).thenReturn(null);

        assertThatIllegalArgumentException().isThrownBy(() ->
                service.purgeRemediationTest(user("platform", "default"), 42L, runId));

        verifyNoInteractions(auditLogMapper);
    }

    private SecurityUser user(String scope, String tenantId) {
        return new SecurityUser(7L, "admin", "", tenantId, null, scope,
                Set.of("cmdb_alert:acknowledge"));
    }
}
