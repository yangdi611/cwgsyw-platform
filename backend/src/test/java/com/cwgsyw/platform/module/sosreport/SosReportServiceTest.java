package com.cwgsyw.platform.module.sosreport;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.changedoc.MinioStorageService;
import com.cwgsyw.platform.module.sosreport.dto.SosReportVO;
import com.cwgsyw.platform.module.sosreport.entity.SosReport;
import com.cwgsyw.platform.module.sosreport.mapper.SosCmdbRequestMapper;
import com.cwgsyw.platform.module.sosreport.mapper.SosReportMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SosReportServiceTest {

    private static final byte[] XZ = {(byte) 0xFD, '7', 'z', 'X', 'Z', 0, 1, 2, 3};

    @Mock SosReportMapper reportMapper;
    @Mock SosCmdbRequestMapper requestMapper;
    @Mock UserMapper userMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock MinioStorageService storageService;

    private SosReportService service;
    private final SecurityUser user = SosTestSupport.user("tenant-a", 7L, "sos_report:upload");

    @BeforeEach
    void setUp() {
        SosTestSupport.initTables();
        PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
        when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        service = new SosReportService(reportMapper, requestMapper, userMapper, auditLogMapper, storageService,
            new TransactionTemplate(transactionManager));
        when(reportMapper.selectCount(any())).thenReturn(0L);
        when(requestMapper.selectCount(any())).thenReturn(0L);
    }

    private static MultipartFile file(String name, byte[] content) {
        return new MockMultipartFile("file", name, "application/x-xz", content);
    }

    private String errorCode(MultipartFile file) {
        return assertThrows(BusinessException.class, () -> service.upload(user, file)).getErrorCode();
    }

    @Test
    void uploadStoresPendingReportWithAudit() {
        SosReportVO result = service.upload(user, file("sosreport-a.tar.xz", XZ));

        ArgumentCaptor<SosReport> saved = ArgumentCaptor.forClass(SosReport.class);
        verify(reportMapper).insert(saved.capture());
        SosReport report = saved.getValue();
        assertEquals("tenant-a", report.getTenantId());
        assertEquals(SosReport.STATUS_PENDING, report.getStatus());
        assertEquals(64, report.getContentSha256().length());
        assertEquals(7L, report.getCreatedBy());
        assertTrue(report.getNextAttemptAt() != null, "没有 next_attempt_at 的记录不会被 worker 选中");
        assertEquals("sosreport-a.tar.xz", result.getFileName());
        assertNull(result.getFacts());

        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(audit.capture());
        assertEquals("upload", audit.getValue().getAction());
        assertEquals(7L, audit.getValue().getOperatorId());
    }

    @Test
    void objectKeyDoesNotUseTheFileName() {
        service.upload(user, file("../../evil name.tar.xz", XZ));

        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        verify(storageService).upload(key.capture(), any(InputStream.class), anyLong(), anyString());
        assertTrue(key.getValue().startsWith("sos-reports/"));
        assertFalse(key.getValue().contains("evil"));
        assertFalse(key.getValue().contains(".."));
    }

    @Test
    void rejectsWrongFileNames() {
        assertEquals("SOS_REPORT_FORMAT", errorCode(file("report.zip", XZ)));
        assertEquals("SOS_REPORT_FORMAT", errorCode(file("report.tar", XZ)));
        assertEquals("SOS_REPORT_EMPTY", errorCode(file("report.tar.xz", new byte[0])));
    }

    @Test
    void rejectsContentThatIsNotACompressedArchive() {
        assertEquals("SOS_REPORT_FORMAT", errorCode(file("report.tar.xz", "PK\u0003\u0004 not xz".getBytes())));
        verify(storageService, never()).upload(any(), any(), anyLong(), any());
    }

    @Test
    void rejectsOversizedUpload() throws IOException {
        MultipartFile large = mock(MultipartFile.class);
        when(large.isEmpty()).thenReturn(false);
        when(large.getSize()).thenReturn(SosReportService.MAX_UPLOAD_BYTES + 1);
        when(large.getOriginalFilename()).thenReturn("big.tar.xz");
        when(large.getInputStream()).thenReturn(new ByteArrayInputStream(XZ));

        assertEquals("SOS_REPORT_TOO_LARGE", errorCode(large));
        verify(storageService, never()).upload(any(), any(), anyLong(), any());
    }

    @Test
    void rejectsDuplicateBeforeStoring() {
        when(reportMapper.selectCount(any())).thenReturn(1L);

        assertEquals("SOS_REPORT_DUPLICATE", errorCode(file("a.tar.xz", XZ)));
        verify(storageService, never()).upload(any(), any(), anyLong(), any());
    }

    @Test
    void concurrentDuplicateRemovesStoredObject() {
        doThrow(new DuplicateKeyException("uq")).when(reportMapper).insert(any(SosReport.class));

        assertEquals("SOS_REPORT_DUPLICATE", errorCode(file("a.tar.xz", XZ)));
        verify(storageService).delete(anyString());
    }

    @Test
    void failedInsertRemovesStoredObject() {
        doThrow(new IllegalStateException("db down")).when(reportMapper).insert(any(SosReport.class));

        assertThrows(IllegalStateException.class, () -> service.upload(user, file("a.tar.xz", XZ)));
        verify(storageService).delete(anyString());
    }

    @Test
    void sanitizesFileNames() {
        assertEquals("a.tar.xz", SosReportService.safeFileName("../../etc/a.tar.xz"));
        assertEquals("a.tar.xz", SosReportService.safeFileName("C:\\dir\\a.tar.xz"));
        assertEquals("ab.tar.xz", SosReportService.safeFileName("a\u0000b.tar.xz"));
        assertEquals("", SosReportService.safeFileName(null));
        assertEquals(255, SosReportService.safeFileName("x".repeat(400) + ".tar.xz").length());
    }

    @Test
    void reportOutsideTenantIsNotFound() {
        when(reportMapper.selectOne(any())).thenReturn(null);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.detail(user, 5L));

        assertEquals("SOS_REPORT_NOT_FOUND", exception.getErrorCode());
        assertEquals(404, exception.getHttpStatus());
    }

    @Test
    void deleteIsSoftAndPurgesObject() {
        SosReport report = new SosReport();
        report.setId(5L);
        report.setTenantId("tenant-a");
        report.setObjectKey("sos-reports/abc");
        when(reportMapper.selectOne(any())).thenReturn(report);

        service.delete(user, 5L);

        assertEquals(7L, report.getDeletedBy());
        verify(reportMapper).updateById(report);
        verify(reportMapper).deleteById(5L);
        verify(storageService).deleteOrThrow("sos-reports/abc");
        verify(reportMapper).clearObjectKey(5L, "sos-reports/abc");
    }

    @Test
    void cannotDeleteWhileApprovalIsPending() {
        SosReport report = new SosReport();
        report.setId(5L);
        report.setTenantId("tenant-a");
        when(reportMapper.selectOne(any())).thenReturn(report);
        when(requestMapper.selectCount(any())).thenReturn(1L);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.delete(user, 5L));

        assertEquals("SOS_REPORT_IN_APPROVAL", exception.getErrorCode());
        verify(reportMapper, never()).deleteById(any(Long.class));
    }

    @Test
    void failedPurgeKeepsTheKeyForRetry() {
        doThrow(BusinessException.serviceUnavailable("STORAGE_DELETE_FAILED", "x"))
            .when(storageService).deleteOrThrow("sos-reports/abc");

        service.purgeObject(5L, "sos-reports/abc");

        verify(reportMapper, never()).clearObjectKey(eq(5L), any());
    }

    @Test
    void rejectsUnknownStatusFilter() {
        assertThrows(IllegalArgumentException.class, () -> service.list(user, null, "bogus", 1, 20));
    }
}
