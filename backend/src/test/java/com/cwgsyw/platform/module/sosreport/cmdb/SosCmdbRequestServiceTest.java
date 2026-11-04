package com.cwgsyw.platform.module.sosreport.cmdb;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.sosreport.SosTestSupport;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.CmdbPreviewVO;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.CmdbRequestVO;
import com.cwgsyw.platform.module.sosreport.entity.SosCmdbRequest;
import com.cwgsyw.platform.module.sosreport.entity.SosReport;
import com.cwgsyw.platform.module.sosreport.mapper.SosCmdbRequestMapper;
import com.cwgsyw.platform.module.sosreport.mapper.SosReportMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.workflow.adapter.SosCmdbWorkflowAdapter;
import com.cwgsyw.platform.module.workflow.event.WorkflowBusinessInstance;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowRuntimeFacade;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DuplicateKeyException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SosCmdbRequestServiceTest {

    @Mock SosReportMapper reportMapper;
    @Mock SosCmdbRequestMapper requestMapper;
    @Mock SosCmdbDraftService draftService;
    @Mock SosCmdbWorkflowAdapter adapter;
    @Mock WorkflowRuntimeFacade facade;
    @Mock UserMapper userMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock ApplicationEventPublisher eventPublisher;

    private SosCmdbRequestService service;
    private final SecurityUser user = SosTestSupport.user("tenant-a", 7L, "sos_report:submit");
    private SosReport report;
    private CmdbPreviewVO preview;

    @BeforeEach
    void setUp() {
        SosTestSupport.initTables();
        service = new SosCmdbRequestService(reportMapper, requestMapper, draftService, adapter, facade, userMapper,
            auditLogMapper, eventPublisher);
        report = new SosReport();
        report.setId(5L);
        report.setTenantId("tenant-a");
        report.setStatus(SosReport.STATUS_PARSED);
        when(reportMapper.selectOne(any())).thenReturn(report);

        preview = new CmdbPreviewVO();
        preview.setAction(SosCmdbRequest.ACTION_CREATE);
        preview.setInstanceName("web-01");
        preview.setCanSubmit(true);
        List<Map<String, Object>> details = List.of(
            Map.of("fieldKey", "sn", "name", "序列号", "origin", "preset"),
            Map.of("fieldKey", "logical_cores", "name", "逻辑核", "origin", "confirmed", "ruleSource", "ai"));
        when(draftService.build(eq(report), any())).thenReturn(
            new SosCmdbDraftService.Draft(preview, Map.of("sn", "SN-1", "logical_cores", 128), details, null));

        doAnswer(invocation -> {
            ((SosCmdbRequest) invocation.getArgument(0)).setId(9L);
            return 1;
        }).when(requestMapper).insert(any(SosCmdbRequest.class));
        when(adapter.canSubmit("tenant-a", "9", user)).thenReturn(true);
        WorkflowBusinessInstance instance = new WorkflowBusinessInstance();
        instance.setProcessInstanceId("pi-1");
        when(facade.startBusinessProcess(any())).thenReturn(instance);
    }

    @Test
    void savesProvenanceSnapshotStartsProcessAndAnnouncesTasks() {
        CmdbRequestVO result = service.submit(user, 5L, null);

        ArgumentCaptor<SosCmdbRequest> saved = ArgumentCaptor.forClass(SosCmdbRequest.class);
        verify(requestMapper).insert(saved.capture());
        assertEquals(SosCmdbRequest.STATUS_PENDING, saved.getValue().getStatus());
        assertEquals("tenant-a", saved.getValue().getTenantId());
        assertEquals("ai", saved.getValue().getFieldDetails().get(1).get("ruleSource"), "审批内容的 AI 标注来自这份快照");
        assertEquals("pi-1", saved.getValue().getProcessInstanceId());
        assertEquals(2, result.getFieldDetails().size());

        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(audit.capture());
        assertEquals("cmdb_submit", audit.getValue().getAction());
        assertTrue(audit.getValue().getRemark().contains("aiFields=1"), audit.getValue().getRemark());

        verify(eventPublisher).publishEvent(new SosApprovalTasksChangedEvent("tenant-a", 9L));
    }

    @Test
    void blockedDraftCreatesNothing() {
        preview.setCanSubmit(false);
        preview.getBlockingReasons().add("必填字段缺失：序列号");

        BusinessException exception = assertThrows(BusinessException.class, () -> service.submit(user, 5L, null));

        assertEquals("SOS_CMDB_BLOCKED", exception.getErrorCode());
        assertTrue(exception.getMessage().contains("序列号"));
        verify(requestMapper, never()).insert(any(SosCmdbRequest.class));
        verify(facade, never()).startBusinessProcess(any());
        verify(eventPublisher, never()).publishEvent(any(Object.class));
    }

    @Test
    void unparsedReportCannotBeSubmitted() {
        report.setStatus(SosReport.STATUS_PENDING);

        assertEquals("SOS_REPORT_NOT_PARSED",
            assertThrows(BusinessException.class, () -> service.submit(user, 5L, null)).getErrorCode());
    }

    @Test
    void reportOutsideTenantIsNotFound() {
        when(reportMapper.selectOne(any())).thenReturn(null);

        assertEquals("SOS_REPORT_NOT_FOUND",
            assertThrows(BusinessException.class, () -> service.submit(user, 5L, null)).getErrorCode());
    }

    @Test
    void submitterWithoutPermissionStartsNoProcess() {
        when(adapter.canSubmit("tenant-a", "9", user)).thenReturn(false);

        assertEquals("SOS_CMDB_FORBIDDEN",
            assertThrows(BusinessException.class, () -> service.submit(user, 5L, null)).getErrorCode());
        verify(facade, never()).startBusinessProcess(any());
    }

    @Test
    void concurrentSubmitIsRejected() {
        doThrow(new DuplicateKeyException("uq")).when(requestMapper).insert(any(SosCmdbRequest.class));

        assertEquals("SOS_CMDB_PENDING",
            assertThrows(BusinessException.class, () -> service.submit(user, 5L, null)).getErrorCode());
    }
}
