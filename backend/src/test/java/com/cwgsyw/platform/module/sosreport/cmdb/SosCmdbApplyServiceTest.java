package com.cwgsyw.platform.module.sosreport.cmdb;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.instance.CiInstanceDetailVO;
import com.cwgsyw.platform.module.cmdb.dto.instance.CreateInstanceRequest;
import com.cwgsyw.platform.module.cmdb.dto.instance.UpdateInstanceRequest;
import com.cwgsyw.platform.module.cmdb.service.CiInstanceCommandService;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.sosreport.SosTestSupport;
import com.cwgsyw.platform.module.sosreport.entity.SosCmdbRequest;
import com.cwgsyw.platform.module.sosreport.mapper.SosCmdbRequestMapper;
import com.cwgsyw.platform.module.workflow.event.WorkflowCompletedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SosCmdbApplyServiceTest {

    @Mock SosCmdbRequestMapper requestMapper;
    @Mock CiInstanceCommandService commandService;
    @Mock AuditLogMapper auditLogMapper;
    @Mock NotificationService notificationService;
    @Mock PlatformTransactionManager transactionManager;

    private SosCmdbApplyService service;
    private SosCmdbRequest request;

    @BeforeEach
    void setUp() {
        SosTestSupport.initTables();
        when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        service = new SosCmdbApplyService(requestMapper, commandService, auditLogMapper, notificationService, transactionManager);
        request = new SosCmdbRequest();
        request.setId(9L);
        request.setTenantId("tenant-a");
        request.setReportId(5L);
        request.setModelCode("host");
        request.setAction(SosCmdbRequest.ACTION_CREATE);
        request.setInstanceName("web-01");
        request.setProposedFields(Map.of("sn", "SN-1", "inner_ip", "10.0.0.1"));
        request.setStatus(SosCmdbRequest.STATUS_PENDING);
        request.setSubmitterId(3L);
        when(requestMapper.selectOne(any())).thenReturn(request);
    }

    private static WorkflowCompletedEvent event(boolean approved) {
        return WorkflowCompletedEvent.builder()
            .tenantId("tenant-a").businessType("sos_cmdb_request").businessId("9")
            .processInstanceId("pi-1").approved(approved).comment("ok").approverId(8L).build();
    }

    private String auditAction() {
        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(audit.capture());
        return audit.getValue().getAction();
    }

    @Test
    void approvalCreatesInstanceAsApprover() {
        CiInstanceDetailVO detail = new CiInstanceDetailVO();
        detail.setId(100L);
        when(commandService.create(any(), eq("tenant-a"), eq(8L))).thenReturn(detail);

        service.complete(event(true));

        ArgumentCaptor<CreateInstanceRequest> created = ArgumentCaptor.forClass(CreateInstanceRequest.class);
        verify(commandService).create(created.capture(), eq("tenant-a"), eq(8L));
        assertEquals("host", created.getValue().getModelId());
        assertEquals("web-01", created.getValue().getName());
        assertEquals("SN-1", created.getValue().getFieldsData().get("sn"));
        assertEquals(SosCmdbRequest.STATUS_APPLIED, request.getStatus());
        assertEquals(100L, request.getResultInstanceId());
        assertEquals(8L, request.getDecidedBy());
        assertEquals("cmdb_applied", auditAction());
        verify(requestMapper).lockIdentity("sos-cmdb:tenant-a:SN-1");
        verify(notificationService).notify(eq("tenant-a"), eq(3L), anyString(), anyString(), anyString(), eq("sos_report"), eq(5L));
    }

    @Test
    void approvalUpdatesTargetInstance() {
        request.setAction(SosCmdbRequest.ACTION_UPDATE);
        request.setTargetInstanceId(100L);

        service.complete(event(true));

        ArgumentCaptor<UpdateInstanceRequest> updated = ArgumentCaptor.forClass(UpdateInstanceRequest.class);
        verify(commandService).update(eq(100L), updated.capture(), eq("tenant-a"), eq(8L));
        assertEquals("SN-1", updated.getValue().getFieldsData().get("sn"));
        verify(commandService, never()).create(any(), anyString(), any());
        assertEquals(SosCmdbRequest.STATUS_APPLIED, request.getStatus());
        assertEquals(100L, request.getResultInstanceId());
    }

    @Test
    void rejectionNeverWritesCmdb() {
        service.complete(event(false));

        verify(commandService, never()).create(any(), anyString(), any());
        verify(commandService, never()).update(any(), any(), anyString(), any());
        assertEquals(SosCmdbRequest.STATUS_REJECTED, request.getStatus());
        assertNull(request.getResultInstanceId());
        assertEquals("cmdb_rejected", auditAction());
    }

    @Test
    void writeFailureIsRecordedWithoutFailingTheApproval() {
        when(commandService.create(any(), anyString(), any())).thenThrow(new IllegalArgumentException("字段 序列号 的值已存在: SN-1"));

        service.complete(event(true));

        assertEquals(SosCmdbRequest.STATUS_APPLY_FAILED, request.getStatus());
        assertTrue(request.getFailureMessage().contains("已存在"));
        verify(requestMapper).updateById(request);
        assertEquals("cmdb_apply_failed", auditAction());
        verify(notificationService).notify(eq("tenant-a"), eq(3L), anyString(), anyString(), anyString(), eq("sos_report"), eq(5L));
    }

    @Test
    void writesInsideASavepoint() {
        CiInstanceDetailVO detail = new CiInstanceDetailVO();
        detail.setId(100L);
        when(commandService.create(any(), anyString(), any())).thenReturn(detail);

        service.complete(event(true));

        ArgumentCaptor<TransactionDefinition> definition = ArgumentCaptor.forClass(TransactionDefinition.class);
        verify(transactionManager).getTransaction(definition.capture());
        assertEquals(TransactionDefinition.PROPAGATION_NESTED, definition.getValue().getPropagationBehavior());
    }

    @Test
    void repeatedCallbackIsIgnored() {
        request.setStatus(SosCmdbRequest.STATUS_APPLIED);

        service.complete(event(true));

        verify(commandService, never()).create(any(), anyString(), any());
        verify(requestMapper, never()).updateById(any(SosCmdbRequest.class));
        verify(auditLogMapper, never()).insert(any(AuditLog.class));
    }

    @Test
    void missingRequestIsIgnored() {
        when(requestMapper.selectOne(any())).thenReturn(null);

        service.complete(event(true));

        verify(commandService, never()).create(any(), anyString(), any());
    }

    @Test
    void longFailureMessageIsBounded() {
        when(commandService.create(any(), anyString(), any())).thenThrow(new IllegalArgumentException("x".repeat(2000)));

        service.complete(event(true));

        assertEquals(500, request.getFailureMessage().length());
    }
}
