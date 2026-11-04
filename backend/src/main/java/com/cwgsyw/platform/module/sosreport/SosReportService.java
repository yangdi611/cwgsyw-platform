package com.cwgsyw.platform.module.sosreport;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.changedoc.MinioStorageService;
import com.cwgsyw.platform.module.sosreport.dto.SosReportVO;
import com.cwgsyw.platform.module.sosreport.entity.SosCmdbRequest;
import com.cwgsyw.platform.module.sosreport.entity.SosReport;
import com.cwgsyw.platform.module.sosreport.mapper.SosCmdbRequestMapper;
import com.cwgsyw.platform.module.sosreport.mapper.SosReportMapper;
import com.cwgsyw.platform.module.sosreport.parser.SosArchiveReader;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * SOS 报告的上传、查询和删除。解析由 {@link SosReportParseWorker} 在后台完成。
 *
 * <p>数据范围是租户级，与 CMDB 实例一致。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SosReportService {

    public static final long MAX_UPLOAD_BYTES = 200L * 1024 * 1024;
    private static final int MAX_FILE_NAME_LENGTH = 255;
    private static final int MAX_PAGE_SIZE = 100;
    private static final List<String> ALLOWED_SUFFIXES = List.of(".tar.xz", ".txz", ".tar.gz", ".tgz");
    private static final Set<String> STATUSES = Set.of(
        SosReport.STATUS_PENDING, SosReport.STATUS_PARSING, SosReport.STATUS_PARSED, SosReport.STATUS_FAILED);

    private final SosReportMapper reportMapper;
    private final SosCmdbRequestMapper requestMapper;
    private final UserMapper userMapper;
    private final AuditLogMapper auditLogMapper;
    private final MinioStorageService storageService;
    private final TransactionTemplate transactionTemplate;

    public SosReportVO upload(SecurityUser user, MultipartFile file) {
        String fileName = validateFile(file);
        String tenantId = user.getTenantId();
        String sha256 = inspectContent(file);
        rejectDuplicate(tenantId, sha256);

        // 对象名不使用原文件名：文件名是外部输入。
        String objectKey = "sos-reports/" + UUID.randomUUID();
        try (InputStream input = file.getInputStream()) {
            storageService.upload(objectKey, input, file.getSize(), "application/octet-stream");
        } catch (IOException e) {
            throw new IllegalStateException("读取上传文件失败", e);
        }

        LocalDateTime now = LocalDateTime.now();
        SosReport report = new SosReport();
        report.setTenantId(tenantId);
        report.setFileName(fileName);
        report.setFileSize(file.getSize());
        report.setContentSha256(sha256);
        report.setObjectKey(objectKey);
        report.setStatus(SosReport.STATUS_PENDING);
        report.setAttemptCount(0);
        report.setNextAttemptAt(now);
        report.setCreatedBy(user.getUserId());
        report.setUpdatedBy(user.getUserId());
        try {
            transactionTemplate.executeWithoutResult(status -> {
                reportMapper.insert(report);
                auditLogMapper.insert(AuditLog.builder()
                    .tenantId(tenantId).module("sos_report").action("upload")
                    .targetId(report.getId()).targetType("sos_report")
                    .operatorId(user.getUserId())
                    .remark("size=" + file.getSize() + " sha256=" + sha256)
                    .createdAt(now).build());
            });
        } catch (DuplicateKeyException e) {
            storageService.delete(objectKey);
            throw duplicate();
        } catch (RuntimeException e) {
            storageService.delete(objectKey);
            throw e;
        }
        return toVO(report, Map.of(), false);
    }

    public PageResult<SosReportVO> list(SecurityUser user, String keyword, String status, int page, int size) {
        int safePage = Math.max(page, 1);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        if (status != null && !status.isBlank() && !STATUSES.contains(status)) {
            throw new IllegalArgumentException("未知的解析状态");
        }

        long total = reportMapper.selectCount(listQuery(user.getTenantId(), keyword, status));
        // 列表不读取 facts：单份可达数十 KB。
        LambdaQueryWrapper<SosReport> query = listQuery(user.getTenantId(), keyword, status)
            .select(SosReport::getId, SosReport::getTenantId, SosReport::getFileName, SosReport::getFileSize,
                SosReport::getStatus, SosReport::getErrorCode, SosReport::getErrorMessage, SosReport::getSosVersion,
                SosReport::getHostname, SosReport::getSerialNumber, SosReport::getPrimaryIp, SosReport::getSystemUuid,
                SosReport::getCollectedAt, SosReport::getParsedAt, SosReport::getCreatedAt, SosReport::getCreatedBy)
            .orderByDesc(SosReport::getCreatedAt)
            .orderByDesc(SosReport::getId);
        List<SosReport> records = reportMapper.selectPage(new Page<>(safePage, safeSize, false), query).getRecords();

        Map<Long, String> names = userNames(records.stream().map(SosReport::getCreatedBy).filter(Objects::nonNull).collect(Collectors.toSet()));
        PageResult<SosReportVO> result = new PageResult<>();
        result.setRecords(records.stream().map(report -> toVO(report, names, false)).toList());
        result.setTotal(total);
        result.setPage(safePage);
        result.setSize(safeSize);
        return result;
    }

    public SosReportVO detail(SecurityUser user, Long id) {
        SosReport report = require(user.getTenantId(), id);
        Map<Long, String> names = report.getCreatedBy() == null ? Map.of() : userNames(Set.of(report.getCreatedBy()));
        return toVO(report, names, true);
    }

    public void delete(SecurityUser user, Long id) {
        String tenantId = user.getTenantId();
        SosReport report = require(tenantId, id);
        boolean pendingApproval = requestMapper.selectCount(new LambdaQueryWrapper<SosCmdbRequest>()
            .eq(SosCmdbRequest::getTenantId, tenantId)
            .eq(SosCmdbRequest::getReportId, id)
            .eq(SosCmdbRequest::getStatus, SosCmdbRequest.STATUS_PENDING)) > 0;
        if (pendingApproval) {
            throw new BusinessException(HttpStatus.CONFLICT, "SOS_REPORT_IN_APPROVAL", "该报告有审批中的入库申请，不能删除");
        }

        LocalDateTime now = LocalDateTime.now();
        transactionTemplate.executeWithoutResult(status -> {
            report.setDeletedAt(now);
            report.setDeletedBy(user.getUserId());
            reportMapper.updateById(report);
            reportMapper.deleteById(id);
            auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("sos_report").action("delete")
                .targetId(id).targetType("sos_report")
                .operatorId(user.getUserId())
                .remark("sha256=" + report.getContentSha256())
                .createdAt(now).build());
        });
        // 原始压缩包如果还在（解析未结束），由 worker 的清理任务兜底。
        purgeObject(id, report.getObjectKey());
    }

    /** 删除原始压缩包。失败时保留 key，由 worker 下一轮重试，确保凭据不会长期留存。 */
    void purgeObject(Long id, String objectKey) {
        if (objectKey == null) return;
        try {
            storageService.deleteOrThrow(objectKey);
            reportMapper.clearObjectKey(id, objectKey);
        } catch (RuntimeException e) {
            log.warn("SOS 报告原始文件清理失败，将重试: reportId={} error={}", id, e.getClass().getSimpleName());
        }
    }

    SosReport require(String tenantId, Long id) {
        SosReport report = reportMapper.selectOne(new LambdaQueryWrapper<SosReport>()
            .eq(SosReport::getTenantId, tenantId)
            .eq(SosReport::getId, id));
        if (report == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "SOS_REPORT_NOT_FOUND", "SOS 报告不存在");
        }
        return report;
    }

    private LambdaQueryWrapper<SosReport> listQuery(String tenantId, String keyword, String status) {
        LambdaQueryWrapper<SosReport> query = new LambdaQueryWrapper<SosReport>().eq(SosReport::getTenantId, tenantId);
        if (status != null && !status.isBlank()) query.eq(SosReport::getStatus, status);
        if (keyword != null && !keyword.isBlank()) {
            String value = keyword.trim();
            query.and(w -> w.like(SosReport::getFileName, value)
                .or().like(SosReport::getHostname, value)
                .or().like(SosReport::getSerialNumber, value)
                .or().like(SosReport::getPrimaryIp, value));
        }
        return query;
    }

    private String validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw BusinessException.badRequest("SOS_REPORT_EMPTY", "请选择要上传的文件");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE, "SOS_REPORT_TOO_LARGE", "文件不能超过 200 MB");
        }
        String fileName = safeFileName(file.getOriginalFilename());
        String lower = fileName.toLowerCase(Locale.ROOT);
        if (ALLOWED_SUFFIXES.stream().noneMatch(lower::endsWith)) {
            throw BusinessException.badRequest("SOS_REPORT_FORMAT", "只支持 .tar.xz 和 .tar.gz 格式");
        }
        return fileName;
    }

    /** 只保留文件名本身，去掉路径和控制字符。 */
    static String safeFileName(String original) {
        String name = original == null ? "" : original;
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        name = name.substring(slash + 1).replaceAll("\\p{Cntrl}", "").trim();
        if (name.length() > MAX_FILE_NAME_LENGTH) name = name.substring(name.length() - MAX_FILE_NAME_LENGTH);
        return name;
    }

    /** 校验文件头并计算摘要。摘要用于拒绝重复上传。 */
    private String inspectContent(MultipartFile file) {
        try (DigestInputStream input = new DigestInputStream(file.getInputStream(), MessageDigest.getInstance("SHA-256"))) {
            byte[] magic = input.readNBytes(6);
            if (!SosArchiveReader.isSupportedMagic(magic)) {
                throw BusinessException.badRequest("SOS_REPORT_FORMAT", "文件内容不是 .tar.xz 或 .tar.gz 压缩包");
            }
            input.transferTo(java.io.OutputStream.nullOutputStream());
            return HexFormat.of().formatHex(input.getMessageDigest().digest());
        } catch (IOException | NoSuchAlgorithmException e) {
            throw new IllegalStateException("读取上传文件失败", e);
        }
    }

    private void rejectDuplicate(String tenantId, String sha256) {
        long count = reportMapper.selectCount(new LambdaQueryWrapper<SosReport>()
            .eq(SosReport::getTenantId, tenantId)
            .eq(SosReport::getContentSha256, sha256));
        if (count > 0) throw duplicate();
    }

    private static BusinessException duplicate() {
        return new BusinessException(HttpStatus.CONFLICT, "SOS_REPORT_DUPLICATE", "这份报告已经上传过");
    }

    private Map<Long, String> userNames(Set<Long> ids) {
        if (ids.isEmpty()) return Map.of();
        return userMapper.selectBatchIds(ids).stream().collect(Collectors.toMap(
            User::getId, user -> user.getRealName() != null ? user.getRealName() : user.getUsername()));
    }

    private SosReportVO toVO(SosReport report, Map<Long, String> names, boolean withFacts) {
        SosReportVO vo = new SosReportVO();
        vo.setId(report.getId());
        vo.setFileName(report.getFileName());
        vo.setFileSize(report.getFileSize());
        vo.setStatus(report.getStatus());
        vo.setErrorCode(report.getErrorCode());
        vo.setErrorMessage(report.getErrorMessage());
        vo.setSosVersion(report.getSosVersion());
        vo.setHostname(report.getHostname());
        vo.setSerialNumber(report.getSerialNumber());
        vo.setPrimaryIp(report.getPrimaryIp());
        vo.setSystemUuid(report.getSystemUuid());
        vo.setCollectedAt(report.getCollectedAt());
        vo.setParsedAt(report.getParsedAt());
        vo.setCreatedAt(report.getCreatedAt());
        vo.setCreatedBy(report.getCreatedBy());
        vo.setCreatedByName(names.get(report.getCreatedBy()));
        if (withFacts) {
            vo.setWarnings(report.getWarnings());
            vo.setFacts(report.getFacts());
        }
        return vo;
    }
}
