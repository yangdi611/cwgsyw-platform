package com.cwgsyw.platform.module.sosreport;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.changedoc.MinioStorageService;
import com.cwgsyw.platform.module.sosreport.dto.SosReportVO;
import com.cwgsyw.platform.module.sosreport.dto.SosUploadDtos.StartUploadRequest;
import com.cwgsyw.platform.module.sosreport.dto.SosUploadDtos.UploadSessionVO;
import com.cwgsyw.platform.module.sosreport.entity.SosReport;
import com.cwgsyw.platform.module.sosreport.entity.SosUploadSession;
import com.cwgsyw.platform.module.sosreport.mapper.SosCmdbRequestMapper;
import com.cwgsyw.platform.module.sosreport.mapper.SosReportMapper;
import com.cwgsyw.platform.module.sosreport.mapper.SosUploadSessionMapper;
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

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SosReportUploadServiceTest {

    private static final int CHUNK = SosReportUploadService.CHUNK_SIZE;

    @Mock SosUploadSessionMapper sessionMapper;
    @Mock SosReportMapper reportMapper;
    @Mock SosCmdbRequestMapper requestMapper;
    @Mock UserMapper userMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock MinioStorageService storageService;

    private final SecurityUser user = SosTestSupport.user("tenant-a", 7L, "sos_report:upload");
    private final Map<String, byte[]> objects = new HashMap<>();
    private SosReportUploadService service;

    @BeforeEach
    void setUp() {
        SosTestSupport.initTables();
        PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
        when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        SosReportService reportService = new SosReportService(reportMapper, requestMapper, userMapper, auditLogMapper,
            storageService, new TransactionTemplate(transactionManager));
        service = new SosReportUploadService(sessionMapper, reportService, storageService);

        when(reportMapper.selectCount(any())).thenReturn(0L);
        when(sessionMapper.touch(anyString(), any(), any())).thenReturn(1);
        when(sessionMapper.claimForAssembly(anyString(), any(), any())).thenReturn(1);
        doAnswer(call -> {
            try (InputStream input = call.getArgument(1)) {
                objects.put(call.getArgument(0), input.readNBytes(Math.toIntExact((long) call.getArgument(2))));
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
            return null;
        }).when(storageService).upload(anyString(), any(InputStream.class), anyLong(), anyString());
        when(storageService.download(anyString())).thenAnswer(call -> new ByteArrayInputStream(objects.get(call.<String>getArgument(0))));
        when(storageService.objectSizeIfPresent(anyString())).thenAnswer(call -> {
            byte[] stored = objects.get(call.<String>getArgument(0));
            return stored == null ? -1L : (long) stored.length;
        });
        doAnswer(call -> objects.remove(call.<String>getArgument(0))).when(storageService).deleteOrThrow(anyString());
        doAnswer(call -> objects.remove(call.<String>getArgument(0))).when(storageService).delete(anyString());
    }

    private static StartUploadRequest request(String name, Long size, String sha256) {
        StartUploadRequest request = new StartUploadRequest();
        request.setFileName(name);
        request.setFileSize(size);
        request.setSha256(sha256);
        return request;
    }

    /** 文件头是 xz，其余字节每片不同，顺序错了能被发现。 */
    private static byte[] archive(int size) {
        byte[] content = new byte[size];
        for (int i = 0; i < size; i++) content[i] = (byte) (i / 1024 + i);
        System.arraycopy(new byte[] {(byte) 0xFD, '7', 'z', 'X', 'Z', 0}, 0, content, 0, 6);
        return content;
    }

    private static String sha256(byte[] content) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
    }

    private SosUploadSession session(int fileSize, String expectedSha256) {
        SosUploadSession session = new SosUploadSession();
        session.setId("upload-1");
        session.setTenantId("tenant-a");
        session.setFileName("a.tar.xz");
        session.setFileSize((long) fileSize);
        session.setChunkSize(CHUNK);
        session.setChunkCount((fileSize + CHUNK - 1) / CHUNK);
        session.setExpectedSha256(expectedSha256);
        session.setStatus(SosUploadSession.STATUS_UPLOADING);
        session.setCreatedBy(7L);
        session.setExpiresAt(LocalDateTime.now().plusMinutes(30));
        when(sessionMapper.selectOne(any())).thenReturn(session);
        return session;
    }

    private void sendAllChunks(byte[] content) {
        for (int index = 0; index * CHUNK < content.length; index++) {
            int end = Math.min((index + 1) * CHUNK, content.length);
            service.saveChunk(user, "upload-1", index, chunk(java.util.Arrays.copyOfRange(content, index * CHUNK, end)));
        }
    }

    private static MockMultipartFile chunk(byte[] content) {
        return new MockMultipartFile("chunk", "blob", "application/octet-stream", content);
    }

    private String startError(StartUploadRequest request) {
        return assertThrows(BusinessException.class, () -> service.start(user, request)).getErrorCode();
    }

    @Test
    void startSplitsTheFileIntoOneMegabyteChunksAndRecordsTheOwner() {
        UploadSessionVO result = service.start(user, request("a.tar.xz", (long) CHUNK * 9 + 700_000, null));

        assertEquals(1024 * 1024, result.getChunkSize());
        assertEquals(10, result.getChunkCount());
        ArgumentCaptor<SosUploadSession> saved = ArgumentCaptor.forClass(SosUploadSession.class);
        verify(sessionMapper).insert(saved.capture());
        assertEquals("tenant-a", saved.getValue().getTenantId());
        assertEquals(7L, saved.getValue().getCreatedBy());
        assertEquals(SosUploadSession.STATUS_UPLOADING, saved.getValue().getStatus());
        assertEquals(result.getUploadId(), saved.getValue().getId());
    }

    @Test
    void startCountsAnExactMultipleWithoutAnEmptyLastChunk() {
        assertEquals(2, service.start(user, request("a.tar.xz", (long) CHUNK * 2, null)).getChunkCount());
    }

    @Test
    void startRejectsInvalidRequests() {
        assertEquals("SOS_REPORT_FORMAT", startError(request("a.zip", 10L, null)));
        assertEquals("SOS_REPORT_EMPTY", startError(request("a.tar.xz", 0L, null)));
        assertEquals("SOS_REPORT_EMPTY", startError(request("a.tar.xz", null, null)));
        assertEquals("SOS_REPORT_TOO_LARGE", startError(request("a.tar.xz", SosReportService.MAX_UPLOAD_BYTES + 1, null)));
        assertEquals("SOS_UPLOAD_INVALID_SHA256", startError(request("a.tar.xz", 10L, "not-a-digest")));
        verify(sessionMapper, never()).insert(any(SosUploadSession.class));
    }

    @Test
    void startRejectsAKnownDuplicateBeforeAnyChunkIsSent() {
        when(reportMapper.selectCount(any())).thenReturn(1L);

        assertEquals("SOS_REPORT_DUPLICATE", startError(request("a.tar.xz", 10L, "a".repeat(64))));
        verify(sessionMapper, never()).insert(any(SosUploadSession.class));
    }

    @Test
    void startEvictsTheOldestSessionOnceTheLimitIsReached() {
        SosUploadSession oldest = new SosUploadSession();
        oldest.setId("oldest");
        oldest.setChunkCount(2);
        SosUploadSession middle = new SosUploadSession();
        middle.setId("middle");
        middle.setChunkCount(1);
        SosUploadSession newest = new SosUploadSession();
        newest.setId("newest");
        newest.setChunkCount(1);
        when(sessionMapper.selectList(any())).thenReturn(List.of(oldest, middle, newest));

        service.start(user, request("a.tar.xz", 10L, null));

        verify(sessionMapper).expireNow(eq("oldest"), any());
        verify(storageService).deleteOrThrow(SosReportUploadService.chunkKey("oldest", 1));
        verify(sessionMapper, never()).expireNow(eq("middle"), any());
    }

    @Test
    void anotherUsersSessionLooksMissing() {
        when(sessionMapper.selectOne(any())).thenReturn(null);

        BusinessException exception = assertThrows(BusinessException.class,
            () -> service.saveChunk(user, "someone-elses", 0, chunk(new byte[1])));

        assertEquals("SOS_UPLOAD_NOT_FOUND", exception.getErrorCode());
        assertEquals(404, exception.getHttpStatus());
    }

    @Test
    void expiredSessionLooksMissingEvenBeforeItIsPurged() {
        session(10, null).setExpiresAt(LocalDateTime.now().minusSeconds(1));

        assertEquals("SOS_UPLOAD_NOT_FOUND",
            assertThrows(BusinessException.class, () -> service.complete(user, "upload-1")).getErrorCode());
    }

    @Test
    void chunkIsRejectedWhenItDoesNotFitTheSession() {
        session(CHUNK + 10, null);

        assertEquals("SOS_UPLOAD_CHUNK_INDEX",
            assertThrows(BusinessException.class, () -> service.saveChunk(user, "upload-1", 2, chunk(new byte[10]))).getErrorCode());
        assertEquals("SOS_UPLOAD_CHUNK_INDEX",
            assertThrows(BusinessException.class, () -> service.saveChunk(user, "upload-1", -1, chunk(new byte[10]))).getErrorCode());
        assertEquals("SOS_UPLOAD_CHUNK_SIZE",
            assertThrows(BusinessException.class, () -> service.saveChunk(user, "upload-1", 1, chunk(new byte[11]))).getErrorCode());
        assertEquals("SOS_UPLOAD_CHUNK_SIZE",
            assertThrows(BusinessException.class, () -> service.saveChunk(user, "upload-1", 0, chunk(new byte[10]))).getErrorCode());
        assertTrue(objects.isEmpty());
    }

    @Test
    void firstChunkThatIsNotAnArchiveEndsTheUpload() {
        session(10, null);

        BusinessException exception = assertThrows(BusinessException.class,
            () -> service.saveChunk(user, "upload-1", 0, chunk("PK not an xz".getBytes(), 10)));

        assertEquals("SOS_REPORT_FORMAT", exception.getErrorCode());
        assertTrue(objects.isEmpty());
        verify(sessionMapper).expireNow(eq("upload-1"), any());
        verify(sessionMapper).deleteExpired(eq("upload-1"), any());
    }

    private static MockMultipartFile chunk(byte[] content, int size) {
        return chunk(java.util.Arrays.copyOf(content, size));
    }

    @Test
    void chunkCannotBeAddedOnceTheUploadHasMovedOn() {
        session(10, null).setStatus(SosUploadSession.STATUS_ASSEMBLING);

        assertEquals("SOS_UPLOAD_NOT_ACTIVE",
            assertThrows(BusinessException.class, () -> service.saveChunk(user, "upload-1", 0, chunk(archive(10)))).getErrorCode());
    }

    @Test
    void chunkWrittenAfterTheSessionWasCancelledIsRemoved() {
        session(10, null);
        when(sessionMapper.touch(anyString(), any(), any())).thenReturn(0);

        assertEquals("SOS_UPLOAD_NOT_ACTIVE",
            assertThrows(BusinessException.class, () -> service.saveChunk(user, "upload-1", 0, chunk(archive(10)))).getErrorCode());
        assertTrue(objects.isEmpty());
    }

    @Test
    void completeAssemblesChunksInOrderAndQueuesTheReport() throws Exception {
        byte[] content = archive(CHUNK * 2 + 12_345);
        session(content.length, sha256(content));
        sendAllChunks(content);
        when(reportMapper.insert(any(SosReport.class))).thenAnswer(call -> {
            call.<SosReport>getArgument(0).setId(42L);
            return 1;
        });

        SosReportVO result = service.complete(user, "upload-1");

        assertEquals(42L, result.getId());
        ArgumentCaptor<SosReport> saved = ArgumentCaptor.forClass(SosReport.class);
        verify(reportMapper).insert(saved.capture());
        SosReport report = saved.getValue();
        assertEquals(SosReport.STATUS_PENDING, report.getStatus());
        assertEquals("tenant-a", report.getTenantId());
        assertEquals("a.tar.xz", report.getFileName());
        assertEquals(content.length, report.getFileSize());
        assertEquals(sha256(content), report.getContentSha256());
        assertTrue(report.getObjectKey().startsWith("sos-reports/"));
        assertArrayEquals(content, objects.get(report.getObjectKey()));

        assertEquals(1, objects.size(), "分片可能含凭据，合并后只留最终对象");
        verify(sessionMapper).markCompleted(eq("upload-1"), eq(42L), any(), any());
        verify(auditLogMapper).insert(any(com.cwgsyw.platform.common.entity.AuditLog.class));
    }

    @Test
    void completeWorksWithoutABrowserDigest() throws Exception {
        byte[] content = archive(100);
        session(content.length, null);
        sendAllChunks(content);

        service.complete(user, "upload-1");

        ArgumentCaptor<SosReport> saved = ArgumentCaptor.forClass(SosReport.class);
        verify(reportMapper).insert(saved.capture());
        assertEquals(sha256(content), saved.getValue().getContentSha256());
    }

    @Test
    void resendingAChunkReplacesIt() throws Exception {
        byte[] content = archive(100);
        session(content.length, sha256(content));
        byte[] garbled = archive(100);
        garbled[50] = (byte) (garbled[50] + 1);
        service.saveChunk(user, "upload-1", 0, chunk(garbled));
        service.saveChunk(user, "upload-1", 0, chunk(content));

        service.complete(user, "upload-1");

        verify(reportMapper).insert(any(SosReport.class));
    }

    @Test
    void retryAfterALostResponseReturnsTheSameReport() {
        SosUploadSession session = session(10, null);
        session.setStatus(SosUploadSession.STATUS_COMPLETED);
        session.setReportId(42L);
        SosReport report = new SosReport();
        report.setId(42L);
        report.setCreatedBy(7L);
        report.setStatus(SosReport.STATUS_PENDING);
        when(reportMapper.selectOne(any())).thenReturn(report);

        assertEquals(42L, service.complete(user, "upload-1").getId());
        verify(sessionMapper, never()).claimForAssembly(anyString(), any(), any());
        verify(reportMapper, never()).insert(any(SosReport.class));
    }

    @Test
    void concurrentCompleteIsToldToWait() {
        byte[] content = archive(100);
        session(content.length, null);
        sendAllChunks(content);
        when(sessionMapper.claimForAssembly(anyString(), any(), any())).thenReturn(0);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.complete(user, "upload-1"));

        assertEquals("SOS_UPLOAD_ASSEMBLING", exception.getErrorCode());
        assertEquals(409, exception.getHttpStatus());
        verify(storageService, never()).download(anyString());
    }

    @Test
    void completeRefusesWhileAChunkIsMissingAndKeepsTheOthers() {
        byte[] content = archive(CHUNK + 100);
        session(content.length, null);
        service.saveChunk(user, "upload-1", 0, chunk(java.util.Arrays.copyOf(content, CHUNK)));

        BusinessException exception = assertThrows(BusinessException.class, () -> service.complete(user, "upload-1"));

        assertEquals("SOS_UPLOAD_INCOMPLETE", exception.getErrorCode());
        verify(sessionMapper, never()).claimForAssembly(anyString(), any(), any());
        assertEquals(1, objects.size());
    }

    @Test
    void digestMismatchDiscardsEverything() throws Exception {
        byte[] content = archive(100);
        session(content.length, sha256(new byte[] {1}));
        sendAllChunks(content);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.complete(user, "upload-1"));

        assertEquals("SOS_UPLOAD_CORRUPTED", exception.getErrorCode());
        verify(reportMapper, never()).insert(any(SosReport.class));
        assertTrue(objects.isEmpty());
        verify(sessionMapper).deleteExpired(eq("upload-1"), any());
    }

    @Test
    void duplicateFoundAfterAssemblyDiscardsEverything() {
        byte[] content = archive(100);
        session(content.length, null);
        sendAllChunks(content);
        doThrow(new DuplicateKeyException("uq")).when(reportMapper).insert(any(SosReport.class));

        BusinessException exception = assertThrows(BusinessException.class, () -> service.complete(user, "upload-1"));

        assertEquals("SOS_REPORT_DUPLICATE", exception.getErrorCode());
        assertTrue(objects.isEmpty());
        verify(sessionMapper).deleteExpired(eq("upload-1"), any());
    }

    @Test
    void temporaryStorageFailureKeepsChunksSoTheBrowserCanRetry() {
        byte[] content = archive(100);
        session(content.length, null);
        sendAllChunks(content);
        doThrow(new RuntimeException("minio down")).when(storageService).download(anyString());

        assertThrows(RuntimeException.class, () -> service.complete(user, "upload-1"));

        verify(sessionMapper).releaseAssembly(eq("upload-1"), any(), any());
        verify(sessionMapper, never()).expireNow(anyString(), any());
        assertEquals(1, objects.size(), "分片还在");
        assertTrue(objects.containsKey(SosReportUploadService.chunkKey("upload-1", 0)));
    }

    @Test
    void cancelRemovesChunksAndTheSession() {
        byte[] content = archive(CHUNK + 100);
        session(content.length, null);
        sendAllChunks(content);

        service.cancel(user, "upload-1");

        assertTrue(objects.isEmpty());
        verify(sessionMapper).expireNow(eq("upload-1"), any());
        verify(sessionMapper).deleteExpired(eq("upload-1"), any());
    }

    @Test
    void cancelLeavesACompletedUploadAlone() {
        session(10, null).setStatus(SosUploadSession.STATUS_COMPLETED);

        service.cancel(user, "upload-1");

        verify(sessionMapper, never()).expireNow(anyString(), any());
        verify(storageService, never()).deleteOrThrow(anyString());
    }

    @Test
    void cancelDoesNotInterruptAssembly() {
        session(10, null).setStatus(SosUploadSession.STATUS_ASSEMBLING);

        assertEquals("SOS_UPLOAD_ASSEMBLING",
            assertThrows(BusinessException.class, () -> service.cancel(user, "upload-1")).getErrorCode());
        verify(storageService, never()).deleteOrThrow(anyString());
    }

    @Test
    void purgeRemovesExpiredChunksAndKeepsTheSessionWhenDeletionFails() {
        SosUploadSession failing = new SosUploadSession();
        failing.setId("failing");
        failing.setChunkCount(2);
        SosUploadSession healthy = new SosUploadSession();
        healthy.setId("healthy");
        healthy.setChunkCount(2);
        when(sessionMapper.findExpired(any(), eq(5))).thenReturn(List.of(failing, healthy));
        doThrow(BusinessException.serviceUnavailable("STORAGE_DELETE_FAILED", "x"))
            .when(storageService).deleteOrThrow(SosReportUploadService.chunkKey("failing", 1));

        service.purgeExpired();

        verify(sessionMapper, never()).deleteExpired(eq("failing"), any());
        verify(storageService).deleteOrThrow(SosReportUploadService.chunkKey("healthy", 1));
        verify(sessionMapper).deleteExpired(eq("healthy"), any());
    }

    @Test
    void chunkKeyDoesNotUseTheFileName() {
        String key = SosReportUploadService.chunkKey("upload-1", 3);
        assertEquals("sos-report-uploads/upload-1/3", key);
        assertFalse(key.contains(".tar"));
    }
}
