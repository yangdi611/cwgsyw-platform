package com.cwgsyw.platform.module.config;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SysConfigServiceTest {
    @Mock private SysConfigMapper configMapper;
    @Mock private AuditLogMapper auditLogMapper;
    @InjectMocks private SysConfigService service;

    @Test
    void set_usesAtomicUpsertForMissingOrExistingConfiguration() {
        service.set("default", "daily_report_process_definition_id", "definition-id");

        verify(configMapper).upsertValue("default", "daily_report_process_definition_id", "definition-id");
        verify(auditLogMapper).insert(org.mockito.ArgumentMatchers.any(AuditLog.class));
    }
}
