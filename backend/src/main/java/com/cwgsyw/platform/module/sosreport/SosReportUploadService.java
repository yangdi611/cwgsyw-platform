package com.cwgsyw.platform.module.sosreport;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.changedoc.MinioStorageService;
import com.cwgsyw.platform.module.sosreport.dto.SosReportVO;
import com.cwgsyw.platform.module.sosreport.dto.SosUploadDtos.StartUploadRequest;
import com.cwgsyw.platform.module.sosreport.dto.SosUploadDtos.UploadSessionVO;
import com.cwgsyw.platform.module.sosreport.entity.SosUploadSession;
import com.cwgsyw.platform.module.sosreport.mapper.SosUploadSessionMapper;
import com.cwgsyw.platform.module.sosreport.parser.SosArchiveReader;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.SequenceInputStream;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.Enumeration;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * SOS 报告的分片上传。
 *
 * <p>经 Cloudflare 的请求有 120 秒的响应时限，上传速度慢时整个文件传不完，所以由浏览器切成小片逐片发送。
 * 分片存在对象存储，实例重启和多实例都不影响。MinIO 的 compose 要求除最后一块外每块至少 5 MB，
 * 1 MB 的分片用不了，所以合并时由后端顺序读取再写入。
 *
 * <p>压缩包可能含凭据，分片在完成、取消或过期后都会删除。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SosReportUploadService {

    /** 实测 1 MB 经 Cloudflare 约 70 秒，低于 120 秒时限。 */
    static final int CHUNK_SIZE = 1024 * 1024;
    /** 距离上一次收到分片的时长，不是整个上传的时长。 */
    static final int SESSION_TTL_MINUTES = 60;
    static final int ASSEMBLY_LEASE_MINUTES = 10;
    /** 每个用户同时保留的未完成会话，超过时淘汰最早的，防止反复刷新页面占满存储。 */
    static final int MAX_ACTIVE_SESSIONS = 3;
    private static final int PURGE_BATCH = 5;
    private static final String CHUNK_CONTENT_TYPE = "application/octet-stream";
    private static final Pattern SHA256 = Pattern.compile("[0-9a-f]{64}");

    private final SosUploadSessionMapper sessionMapper;
    private final SosReportService reportService;
    private final MinioStorageService storageService;
    private final TransactionTemplate transactionTemplate;

    public UploadSessionVO start(SecurityUser user, StartUploadRequest request) {
        String fileName = reportService.validateFileName(request.getFileName());
        long fileSize = request.getFileSize() == null ? 0 : request.getFileSize();
        reportService.validateFileSize(fileSize);
        String sha256 = request.getSha256();
        if (sha256 != null) {
            if (!SHA256.matcher(sha256).matches()) {
                throw BusinessException.badRequest("SOS_UPLOAD_INVALID_SHA256", "文件摘要格式不正确");
            }
            reportService.rejectDuplicate(user.getTenantId(), sha256);
        }
        evictOldestSessions(user);

        LocalDateTime now = LocalDateTime.now();
        SosUploadSession session = new SosUploadSession();
        session.setId(UUID.randomUUID().toString());
        session.setTenantId(user.getTenantId());
        session.setFileName(fileName);
        session.setFileSize(fileSize);
        session.setChunkSize(CHUNK_SIZE);
        session.setChunkCount(Math.toIntExact(Math.ceilDiv(fileSize, (long) CHUNK_SIZE)));
        session.setExpectedSha256(sha256);
        session.setStatus(SosUploadSession.STATUS_UPLOADING);
        session.setCreatedBy(user.getUserId());
        session.setExpiresAt(now.plusMinutes(SESSION_TTL_MINUTES));
        session.setCreatedAt(now);
        session.setUpdatedAt(now);
        sessionMapper.insert(session);
        return new UploadSessionVO(session.getId(), session.getChunkSize(), session.getChunkCount());
    }

    /** 同一分片可以重复发送，后一次覆盖前一次，所以浏览器可以放心重试。 */
    public void saveChunk(SecurityUser user, String uploadId, int index, MultipartFile chunk) {
        SosUploadSession session = require(user, uploadId);
        if (!SosUploadSession.STATUS_UPLOADING.equals(session.getStatus())) {
            throw new BusinessException(HttpStatus.CONFLICT, "SOS_UPLOAD_NOT_ACTIVE", "这次上传已经结束，请重新上传");
        }
        if (index < 0 || index >= session.getChunkCount()) {
            throw BusinessException.badRequest("SOS_UPLOAD_CHUNK_INDEX", "分片序号不正确");
        }
        if (chunk.getSize() != expectedChunkSize(session, index)) {
            throw BusinessException.badRequest("SOS_UPLOAD_CHUNK_SIZE", "分片大小不正确");
        }
        if (index == 0) rejectUnlessArchive(session, chunk);

        String key = chunkKey(session.getId(), index);
        try (InputStream input = chunk.getInputStream()) {
            storageService.upload(key, input, chunk.getSize(), CHUNK_CONTENT_TYPE);
        } catch (IOException e) {
            throw new IllegalStateException("读取上传分片失败", e);
        }

        LocalDateTime now = LocalDateTime.now();
        if (sessionMapper.touch(session.getId(), now, now.plusMinutes(SESSION_TTL_MINUTES)) != 1) {
            // 写入期间会话被取消或过期。清理已经结束，这个分片不删就没有人管了。
            storageService.delete(key);
            throw new BusinessException(HttpStatus.CONFLICT, "SOS_UPLOAD_NOT_ACTIVE", "这次上传已经结束，请重新上传");
        }
    }

    /**
     * 合并分片并生成报告。响应丢失后重试是安全的：已完成的会话直接返回同一份报告。
     */
    public SosReportVO complete(SecurityUser user, String uploadId) {
        SosUploadSession session = require(user, uploadId);
        if (SosUploadSession.STATUS_COMPLETED.equals(session.getStatus())) {
            return reportService.detail(user, session.getReportId());
        }
        requireAllChunks(session);

        LocalDateTime claimedAt = LocalDateTime.now();
        if (sessionMapper.claimForAssembly(session.getId(), claimedAt, claimedAt.plusMinutes(ASSEMBLY_LEASE_MINUTES)) != 1) {
            throw assembling();
        }

        String objectKey = assembledKey(session.getId());
        SosReportVO report;
        try {
            String sha256 = assemble(session, objectKey);
            if (session.getExpectedSha256() != null && !session.getExpectedSha256().equals(sha256)) {
                throw BusinessException.badRequest("SOS_UPLOAD_CORRUPTED", "文件校验未通过，请重新上传");
            }
            // 报告和会话状态一起提交，否则报告生成后状态写失败，重试就再也拿不到这份报告。
            report = transactionTemplate.execute(status -> {
                SosReportVO created = reportService.createReport(user, session.getFileName(), session.getFileSize(), sha256, objectKey);
                LocalDateTime now = LocalDateTime.now();
                if (sessionMapper.markCompleted(session.getId(), created.getId(), now, now.plusMinutes(SESSION_TTL_MINUTES)) != 1) {
                    throw new BusinessException(HttpStatus.CONFLICT, "SOS_UPLOAD_NOT_ACTIVE", "这次上传已经结束，请重新上传");
                }
                return created;
            });
        } catch (BusinessException e) {
            // 校验不通过、文件重复或会话已结束，重试也不会成功，立即清理。
            discard(session);
            throw e;
        } catch (RuntimeException e) {
            // 对象存储或数据库的临时故障，保留分片供重试。
            storageService.delete(objectKey);
            LocalDateTime now = LocalDateTime.now();
            sessionMapper.releaseAssembly(session.getId(), now, now.plusMinutes(SESSION_TTL_MINUTES));
            throw e;
        }

        deleteChunksQuietly(session.getId(), session.getChunkCount());
        return report;
    }

    public void cancel(SecurityUser user, String uploadId) {
        SosUploadSession session = require(user, uploadId);
        if (SosUploadSession.STATUS_ASSEMBLING.equals(session.getStatus())) throw assembling();
        // 已完成的会话留给重试，分片已经删除，到期后自然清理。
        if (SosUploadSession.STATUS_COMPLETED.equals(session.getStatus())) return;
        discard(session);
    }

    @Scheduled(fixedDelay = 60_000L, initialDelay = 60_000L)
    public void purgeExpired() {
        LocalDateTime now = LocalDateTime.now();
        for (SosUploadSession session : sessionMapper.findExpired(now, PURGE_BATCH)) {
            purge(session, now);
        }
    }

    /** 其他租户、其他用户的会话和已过期的会话一律视为不存在。 */
    private SosUploadSession require(SecurityUser user, String uploadId) {
        SosUploadSession session = sessionMapper.selectOne(new LambdaQueryWrapper<SosUploadSession>()
            .eq(SosUploadSession::getId, uploadId)
            .eq(SosUploadSession::getTenantId, user.getTenantId())
            .eq(SosUploadSession::getCreatedBy, user.getUserId()));
        if (session == null || !session.getExpiresAt().isAfter(LocalDateTime.now())) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "SOS_UPLOAD_NOT_FOUND", "这次上传不存在或已过期，请重新上传");
        }
        return session;
    }

    private void evictOldestSessions(SecurityUser user) {
        List<SosUploadSession> active = sessionMapper.selectList(new LambdaQueryWrapper<SosUploadSession>()
            .eq(SosUploadSession::getTenantId, user.getTenantId())
            .eq(SosUploadSession::getCreatedBy, user.getUserId())
            .eq(SosUploadSession::getStatus, SosUploadSession.STATUS_UPLOADING)
            .orderByAsc(SosUploadSession::getCreatedAt));
        int excess = active.size() - MAX_ACTIVE_SESSIONS + 1;
        for (int i = 0; i < excess; i++) {
            discard(active.get(i));
        }
    }

    private static long expectedChunkSize(SosUploadSession session, int index) {
        if (index < session.getChunkCount() - 1) return session.getChunkSize();
        return session.getFileSize() - (long) session.getChunkSize() * (session.getChunkCount() - 1);
    }

    /** 不是压缩包就没必要再传完，在第一片就拒绝。 */
    private void rejectUnlessArchive(SosUploadSession session, MultipartFile chunk) {
        try (InputStream input = chunk.getInputStream()) {
            if (!SosArchiveReader.isSupportedMagic(input.readNBytes(6))) {
                discard(session);
                throw BusinessException.badRequest("SOS_REPORT_FORMAT", "文件内容不是 .tar.xz 或 .tar.gz 压缩包");
            }
        } catch (IOException e) {
            throw new IllegalStateException("读取上传分片失败", e);
        }
    }

    private void requireAllChunks(SosUploadSession session) {
        for (int index = 0; index < session.getChunkCount(); index++) {
            if (storageService.objectSizeIfPresent(chunkKey(session.getId(), index)) != expectedChunkSize(session, index)) {
                throw new BusinessException(HttpStatus.CONFLICT, "SOS_UPLOAD_INCOMPLETE", "还有分片没有上传成功，请重新上传");
            }
        }
    }

    /** 边写入边计算摘要，不读两遍。 */
    private String assemble(SosUploadSession session, String objectKey) {
        try (DigestInputStream input = new DigestInputStream(openChunks(session), MessageDigest.getInstance("SHA-256"))) {
            storageService.upload(objectKey, input, session.getFileSize(), CHUNK_CONTENT_TYPE);
            return HexFormat.of().formatHex(input.getMessageDigest().digest());
        } catch (IOException | NoSuchAlgorithmException e) {
            throw new IllegalStateException("合并上传分片失败", e);
        }
    }

    /** 按需打开，最多 200 个分片，不同时占用 200 个连接。 */
    private InputStream openChunks(SosUploadSession session) {
        return new SequenceInputStream(new Enumeration<>() {
            private int next = 0;

            @Override
            public boolean hasMoreElements() {
                return next < session.getChunkCount();
            }

            @Override
            public InputStream nextElement() {
                return storageService.download(chunkKey(session.getId(), next++));
            }
        });
    }

    private void discard(SosUploadSession session) {
        LocalDateTime now = LocalDateTime.now();
        sessionMapper.expireNow(session.getId(), now);
        purge(session, now);
    }

    /** 文件全部删除后才删除会话。删除失败时保留会话，由定时任务重试，确保凭据不会留存。 */
    private void purge(SosUploadSession session, LocalDateTime now) {
        try {
            deleteChunks(session.getId(), session.getChunkCount());
            // 已完成会话的合并结果归报告所有。其他状态下它要么不存在，要么是合并后进程中断留下的。
            if (!SosUploadSession.STATUS_COMPLETED.equals(session.getStatus())) {
                storageService.deleteOrThrow(assembledKey(session.getId()));
            }
            sessionMapper.deleteExpired(session.getId(), now);
        } catch (RuntimeException e) {
            log.warn("SOS 上传文件清理失败，将重试: uploadId={} error={}", session.getId(), e.getClass().getSimpleName());
        }
    }

    private void deleteChunks(String sessionId, int chunkCount) {
        for (int index = 0; index < chunkCount; index++) {
            storageService.deleteOrThrow(chunkKey(sessionId, index));
        }
    }

    /** 报告已经生成，清理失败不影响结果。会话到期后定时任务会再删一次。 */
    private void deleteChunksQuietly(String sessionId, int chunkCount) {
        try {
            deleteChunks(sessionId, chunkCount);
        } catch (RuntimeException e) {
            log.warn("SOS 上传分片清理失败，到期后重试: uploadId={} error={}", sessionId, e.getClass().getSimpleName());
        }
    }

    static String chunkKey(String sessionId, int index) {
        return "sos-report-uploads/" + sessionId + "/" + index;
    }

    /** 由会话决定，进程中断后清理任务才能找到它。重试合并时直接覆盖。 */
    static String assembledKey(String sessionId) {
        return "sos-reports/" + sessionId;
    }

    private static BusinessException assembling() {
        return new BusinessException(HttpStatus.CONFLICT, "SOS_UPLOAD_ASSEMBLING", "服务器正在合并文件，请稍候");
    }
}
