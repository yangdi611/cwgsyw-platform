package com.cwgsyw.platform.module.sosreport;

import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.changedoc.MinioStorageService;
import com.cwgsyw.platform.module.sosreport.entity.SosReport;
import com.cwgsyw.platform.module.sosreport.mapper.SosReportMapper;
import com.cwgsyw.platform.module.sosreport.parser.SosArchiveReader;
import com.cwgsyw.platform.module.sosreport.parser.SosParseException;
import com.cwgsyw.platform.module.sosreport.parser.SosReportParser;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 后台解析 SOS 报告。
 *
 * <p>Spring 的调度线程默认只有一个，解析耗时较长，不能占用它，所以放到独立的单线程执行器。
 * 同一实例同时只解析一份；多实例通过 {@link SosReportMapper#claim} 的条件更新和租约互斥。
 * 这里没有登录用户，操作人按项目约定记为 0。
 */
@Service
@Slf4j
public class SosReportParseWorker {

    static final int MAX_ATTEMPTS = 3;
    private static final int LEASE_MINUTES = 10;
    private static final long SYSTEM_OPERATOR = 0L;

    private final SosReportMapper reportMapper;
    private final AuditLogMapper auditLogMapper;
    private final MinioStorageService storageService;
    private final SosReportService reportService;
    private final TransactionTemplate transactionTemplate;
    private final SosArchiveReader archiveReader = new SosArchiveReader();

    private final ExecutorService executor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "sos-report-parser");
        thread.setDaemon(true);
        return thread;
    });
    private final AtomicBoolean busy = new AtomicBoolean(false);

    public SosReportParseWorker(SosReportMapper reportMapper, AuditLogMapper auditLogMapper,
                                MinioStorageService storageService, SosReportService reportService,
                                TransactionTemplate transactionTemplate) {
        this.reportMapper = reportMapper;
        this.auditLogMapper = auditLogMapper;
        this.storageService = storageService;
        this.reportService = reportService;
        this.transactionTemplate = transactionTemplate;
    }

    @Scheduled(fixedDelay = 10_000L, initialDelay = 30_000L)
    public void poll() {
        if (!busy.compareAndSet(false, true)) return;
        boolean submitted = false;
        try {
            purgeFinishedObjects();
            List<SosReport> due = reportMapper.findDue(LocalDateTime.now(), 1);
            if (due.isEmpty()) return;
            SosReport report = due.get(0);
            executor.execute(() -> {
                try {
                    process(report);
                } catch (RuntimeException e) {
                    log.error("SOS 报告解析任务异常: reportId={} error={}", report.getId(), e.getClass().getSimpleName());
                } finally {
                    busy.set(false);
                }
            });
            submitted = true;
        } finally {
            if (!submitted) busy.set(false);
        }
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    /** 处理一条到期任务。返回前状态已经落库。 */
    void process(SosReport report) {
        LocalDateTime now = LocalDateTime.now();
        if (reportMapper.claim(report.getTenantId(), report.getId(), now, now.plusMinutes(LEASE_MINUTES)) != 1) {
            return;
        }
        int attempt = (report.getAttemptCount() == null ? 0 : report.getAttemptCount()) + 1;
        String objectKey = report.getObjectKey();
        if (objectKey == null) {
            finishFailed(report, "SOURCE_MISSING", "原始文件已不存在，请重新上传");
            return;
        }
        // 进程崩溃（如内存耗尽）走不到下面的 catch，靠认领次数防止同一份文件反复拖垮实例。
        if (attempt > MAX_ATTEMPTS) {
            finishFailed(report, "PARSE_FAILED", "解析多次失败，请稍后重新上传");
            return;
        }

        try (InputStream input = storageService.download(objectKey)) {
            SosArchiveReader.Result archive = archiveReader.read(input);
            SosReportParser.Result parsed = SosReportParser.parse(archive.files());
            finishParsed(report, parsed, archive);
        } catch (SosParseException e) {
            finishFailed(report, e.getCode(), e.getMessage());
        } catch (IOException | RuntimeException e) {
            // 对象存储或数据库的临时故障。只记录异常类型，消息可能包含归档内容。
            log.warn("SOS 报告解析失败: reportId={} attempt={} error={}", report.getId(), attempt, e.getClass().getSimpleName());
            if (attempt >= MAX_ATTEMPTS) {
                finishFailed(report, "PARSE_FAILED", "解析多次失败，请稍后重新上传");
            } else {
                scheduleRetry(report, attempt);
            }
        }
    }

    /** 清理已进入终态或已删除记录的原始压缩包，兜底处理之前失败的删除。 */
    void purgeFinishedObjects() {
        reportMapper.findPurgeable(20).forEach(report -> reportService.purgeObject(report.getId(), report.getObjectKey()));
    }

    private void finishParsed(SosReport report, SosReportParser.Result parsed, SosArchiveReader.Result archive) {
        Map<String, Object> facts = parsed.facts();
        List<String> warnings = new ArrayList<>(archive.warnings());
        warnings.addAll(parsed.warnings());

        SosReport update = new SosReport();
        // BaseEntity 的 tenantId 默认是 default，不显式设置会把其他租户的记录改掉。
        update.setTenantId(report.getTenantId());
        update.setStatus(SosReport.STATUS_PARSED);
        update.setFacts(facts);
        update.setWarnings(warnings);
        update.setParserVersion(SosReportParser.PARSER_VERSION);
        update.setSosVersion(parsed.sosVersion());
        update.setCollectedAt(parsed.collectedAt());
        update.setHostname(text(facts, "system.hostname", 255));
        update.setSerialNumber(text(facts, "system.serialNumber", 255));
        update.setPrimaryIp(text(facts, "network.primaryIp", 64));
        update.setSystemUuid(text(facts, "system.uuid", 64));
        update.setParsedAt(LocalDateTime.now());
        update.setUpdatedBy(SYSTEM_OPERATOR);

        boolean applied = Boolean.TRUE.equals(transactionTemplate.execute(status -> {
            // 通过实体更新路径写 JSONB，保留 JacksonTypeHandler。
            int rows = reportMapper.update(update, new LambdaUpdateWrapper<SosReport>()
                .eq(SosReport::getId, report.getId())
                .eq(SosReport::getTenantId, report.getTenantId())
                .eq(SosReport::getStatus, SosReport.STATUS_PARSING)
                .set(SosReport::getNextAttemptAt, null)
                .set(SosReport::getErrorCode, null)
                .set(SosReport::getErrorMessage, null));
            if (rows != 1) return false;
            writeAudit(report, "parse_success", "parserVersion=" + SosReportParser.PARSER_VERSION);
            return true;
        }));
        if (applied) reportService.purgeObject(report.getId(), report.getObjectKey());
    }

    private void finishFailed(SosReport report, String code, String message) {
        boolean applied = Boolean.TRUE.equals(transactionTemplate.execute(status -> {
            int rows = reportMapper.update(null, new LambdaUpdateWrapper<SosReport>()
                .eq(SosReport::getId, report.getId())
                .eq(SosReport::getTenantId, report.getTenantId())
                .eq(SosReport::getStatus, SosReport.STATUS_PARSING)
                .set(SosReport::getStatus, SosReport.STATUS_FAILED)
                .set(SosReport::getErrorCode, code)
                .set(SosReport::getErrorMessage, message)
                .set(SosReport::getNextAttemptAt, null)
                .set(SosReport::getUpdatedBy, SYSTEM_OPERATOR)
                .set(SosReport::getUpdatedAt, LocalDateTime.now()));
            if (rows != 1) return false;
            writeAudit(report, "parse_failed", "code=" + code);
            return true;
        }));
        if (applied) reportService.purgeObject(report.getId(), report.getObjectKey());
    }

    private void scheduleRetry(SosReport report, int attempt) {
        reportMapper.update(null, new LambdaUpdateWrapper<SosReport>()
            .eq(SosReport::getId, report.getId())
            .eq(SosReport::getTenantId, report.getTenantId())
            .eq(SosReport::getStatus, SosReport.STATUS_PARSING)
            .set(SosReport::getStatus, SosReport.STATUS_PENDING)
            .set(SosReport::getNextAttemptAt, LocalDateTime.now().plusMinutes(attempt))
            .set(SosReport::getUpdatedBy, SYSTEM_OPERATOR)
            .set(SosReport::getUpdatedAt, LocalDateTime.now()));
    }

    private void writeAudit(SosReport report, String action, String remark) {
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(report.getTenantId()).module("sos_report").action(action)
            .targetId(report.getId()).targetType("sos_report")
            .operatorId(SYSTEM_OPERATOR).remark(remark)
            .createdAt(LocalDateTime.now()).build());
    }

    private static String text(Map<String, Object> facts, String key, int max) {
        Object value = facts.get(key);
        if (value == null) return null;
        String text = String.valueOf(value);
        return text.length() > max ? text.substring(0, max) : text;
    }
}
