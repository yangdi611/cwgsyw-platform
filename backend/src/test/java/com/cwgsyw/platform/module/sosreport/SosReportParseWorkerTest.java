package com.cwgsyw.platform.module.sosreport;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.changedoc.MinioStorageService;
import com.cwgsyw.platform.module.sosreport.entity.SosReport;
import com.cwgsyw.platform.module.sosreport.mapper.SosReportMapper;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;
import org.apache.commons.compress.compressors.xz.XZCompressorOutputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SosReportParseWorkerTest {

    @Mock SosReportMapper reportMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock MinioStorageService storageService;
    @Mock SosReportService reportService;

    private SosReportParseWorker worker;
    private SosReport report;

    @BeforeEach
    void setUp() {
        SosTestSupport.initTables();
        PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
        when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        worker = new SosReportParseWorker(reportMapper, auditLogMapper, storageService, reportService,
            new TransactionTemplate(transactionManager));
        report = new SosReport();
        report.setId(5L);
        report.setTenantId("tenant-a");
        report.setObjectKey("sos-reports/abc");
        report.setAttemptCount(0);
        when(reportMapper.claim(eq("tenant-a"), eq(5L), any(), any())).thenReturn(1);
        when(reportMapper.update(any(), any())).thenReturn(1);
    }

    private static byte[] archive() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (XZCompressorOutputStream xz = new XZCompressorOutputStream(out)) {
            TarArchiveOutputStream tar = new TarArchiveOutputStream(xz);
            byte[] bytes = "web-01\n".getBytes(StandardCharsets.UTF_8);
            TarArchiveEntry entry = new TarArchiveEntry("sosreport-x/etc/hostname");
            entry.setSize(bytes.length);
            tar.putArchiveEntry(entry);
            tar.write(bytes);
            tar.closeArchiveEntry();
            tar.finish();
            tar.flush();
        }
        return out.toByteArray();
    }

    @Test
    void parsesSuccessfullyAndPurgesTheArchive() throws IOException {
        when(storageService.download("sos-reports/abc")).thenReturn(new ByteArrayInputStream(archive()));

        worker.process(report);

        ArgumentCaptor<SosReport> update = ArgumentCaptor.forClass(SosReport.class);
        verify(reportMapper).update(update.capture(), any());
        assertEquals(SosReport.STATUS_PARSED, update.getValue().getStatus());
        assertEquals("web-01", update.getValue().getHostname());
        assertEquals(0L, update.getValue().getUpdatedBy(), "后台任务的操作人是系统");
        assertNotNull(update.getValue().getFacts());
        assertTrue(update.getValue().getWarnings().stream().anyMatch(warning -> warning.contains("序列号")));
        verify(reportService).purgeObject(5L, "sos-reports/abc");
        assertEquals("parse_success", auditAction());
    }

    @Test
    void partialUpdateKeepsTheReportTenant() throws IOException {
        // BaseEntity.tenantId 默认是 default，部分更新时不设置就会把记录改到 default 租户。
        when(storageService.download(any())).thenReturn(new ByteArrayInputStream(archive()));

        worker.process(report);

        ArgumentCaptor<SosReport> update = ArgumentCaptor.forClass(SosReport.class);
        verify(reportMapper).update(update.capture(), any());
        assertEquals("tenant-a", update.getValue().getTenantId());
    }

    @Test
    void badArchiveFailsImmediatelyAndStillPurges() {
        when(storageService.download(any())).thenReturn(new ByteArrayInputStream("not an archive".getBytes(StandardCharsets.UTF_8)));

        worker.process(report);

        verify(reportMapper).update(eq(null), any());
        verify(reportService).purgeObject(5L, "sos-reports/abc");
        assertEquals("parse_failed", auditAction());
    }

    @Test
    void transientFailureIsRetriedWithoutPurging() {
        when(storageService.download(any())).thenThrow(new RuntimeException("connection refused"));

        worker.process(report);

        verify(reportMapper).update(eq(null), any());
        verify(reportService, never()).purgeObject(any(), any());
        verify(auditLogMapper, never()).insert(any(AuditLog.class));
    }

    @Test
    void repeatedTransientFailureEndsInFailed() {
        report.setAttemptCount(SosReportParseWorker.MAX_ATTEMPTS - 1);
        when(storageService.download(any())).thenThrow(new RuntimeException("connection refused"));

        worker.process(report);

        verify(reportService).purgeObject(5L, "sos-reports/abc");
        assertEquals("parse_failed", auditAction());
    }

    @Test
    void crashLoopingReportGivesUpWithoutDownloading() {
        report.setAttemptCount(SosReportParseWorker.MAX_ATTEMPTS);

        worker.process(report);

        verify(storageService, never()).download(any());
        assertEquals("parse_failed", auditAction());
    }

    @Test
    void anotherInstanceWinningTheClaimDoesNothing() {
        when(reportMapper.claim(eq("tenant-a"), eq(5L), any(), any())).thenReturn(0);

        worker.process(report);

        verify(storageService, never()).download(any());
        verify(reportMapper, never()).update(any(), any());
    }

    @Test
    void reportDeletedDuringParsingIsNotResurrected() throws IOException {
        when(storageService.download(any())).thenReturn(new ByteArrayInputStream(archive()));
        when(reportMapper.update(any(), any())).thenReturn(0);

        worker.process(report);

        verify(auditLogMapper, never()).insert(any(AuditLog.class));
        verify(reportService, never()).purgeObject(any(), any());
    }

    @Test
    void purgeSweepRetriesLeftoverObjects() {
        SosReport leftover = new SosReport();
        leftover.setId(6L);
        leftover.setObjectKey("sos-reports/old");
        when(reportMapper.findPurgeable(anyInt())).thenReturn(List.of(leftover));

        worker.purgeFinishedObjects();

        verify(reportService).purgeObject(6L, "sos-reports/old");
    }

    @Test
    void pollDoesNothingWithoutDueReports() {
        when(reportMapper.findPurgeable(anyInt())).thenReturn(List.of());
        when(reportMapper.findDue(any(), anyInt())).thenReturn(List.of());

        worker.poll();
        worker.poll();

        verify(reportMapper, never()).claim(any(), any(), any(), any());
        assertFalse(report.getObjectKey().isEmpty());
    }

    private String auditAction() {
        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(audit.capture());
        assertEquals(0L, audit.getValue().getOperatorId());
        assertEquals("tenant-a", audit.getValue().getTenantId());
        return audit.getValue().getAction();
    }
}
