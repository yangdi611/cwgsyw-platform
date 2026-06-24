package com.cwgsyw.platform.module.backup;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.backup.dto.BackupRecordVO;
import com.cwgsyw.platform.module.backup.entity.BackupRecord;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import io.minio.*;
import io.minio.messages.Bucket;
import io.minio.messages.DeleteObject;
import io.minio.messages.Item;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/**
 * 数据库 + MinIO 备份/恢复。
 * 备份产物为 tar.gz：根含 dump.sql（pg_dump 全库）+ minio/&lt;bucket&gt;/&lt;objectKey&gt;。
 * pg_dump/psql/tar 由后端镜像（Dockerfile 中 postgresql16-client + tar）提供。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BackupService {

    private final BackupMapper backupMapper;
    private final AuditLogMapper auditLogMapper;
    private final UserMapper userMapper;
    private final MinioClient minioClient;

    @Value("${spring.datasource.url}")
    private String jdbcUrl;
    @Value("${spring.datasource.username}")
    private String dbUser;
    @Value("${spring.datasource.password}")
    private String dbPassword;
    @Value("${backup.dir:/backups}")
    private String backupDir;
    @Value("${backup.retention-days:30}")
    private int retentionDays;

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH-mm-ss");

    // ===== query =====

    public PageResult<BackupRecordVO> list(int page, int size, String tenantId) {
        LambdaQueryWrapper<BackupRecord> q = new LambdaQueryWrapper<BackupRecord>()
                .eq(BackupRecord::getTenantId, tenantId)
                .eq(BackupRecord::getIsDeleted, false)
                .orderByDesc(BackupRecord::getCreatedAt);
        Page<BackupRecord> p = backupMapper.selectPage(new Page<>(page, size), q);
        return PageResult.of(p.convert(this::toVO));
    }

    public BackupRecord findOrThrow(Long id, String tenantId) {
        BackupRecord r = backupMapper.selectById(id);
        if (r == null || Boolean.TRUE.equals(r.getIsDeleted()) || !r.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("备份记录不存在");
        }
        return r;
    }

    private BackupRecordVO toVO(BackupRecord r) {
        BackupRecordVO vo = new BackupRecordVO();
        vo.setId(r.getId());
        vo.setFileName(r.getFileName());
        vo.setFileSizeBytes(r.getFileSizeBytes());
        vo.setStatus(r.getStatus());
        vo.setBackupType(r.getBackupType());
        vo.setErrorMessage(r.getErrorMessage());
        vo.setCreatedBy(r.getCreatedBy());
        vo.setCreatedAt(r.getCreatedAt());
        if (r.getCreatedBy() != null) {
            User u = userMapper.selectById(r.getCreatedBy());
            vo.setCreatedByName(u != null ? u.getUsername() : null);
        }
        return vo;
    }

    // ===== JDBC URL parsing: jdbc:postgresql://host:port/dbname?params =====

    private String pgHost() {
        return stripPrefix().split("/", 2)[0].split(":")[0];
    }

    private String pgPort() {
        String[] hp = stripPrefix().split("/", 2)[0].split(":");
        return hp.length > 1 ? hp[1] : "5432";
    }

    private String pgDb() {
        String[] parts = stripPrefix().split("/", 2);
        return parts.length > 1 ? parts[1].split("[?]")[0] : "";
    }

    private String stripPrefix() {
        return jdbcUrl.substring("jdbc:postgresql://".length());
    }

    // ===== upload & import =====

    public BackupRecordVO importUpload(org.springframework.web.multipart.MultipartFile file,
                                       Long operatorId, String operatorIp, String tenantId) {
        String name = file.getOriginalFilename();
        if (name == null || !name.endsWith(".tar.gz")) {
            throw new IllegalArgumentException("仅支持 .tar.gz 格式的备份文件");
        }
        try {
            Files.createDirectories(Paths.get(backupDir));
            // 如已存在同名文件，加时间戳前缀避免覆盖
            Path dest = Paths.get(backupDir, name);
            if (Files.exists(dest)) {
                String ts = LocalDateTime.now().format(TS);
                dest = Paths.get(backupDir, ts + "_" + name);
            }
            Files.copy(file.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);

            BackupRecord record = new BackupRecord();
            record.setTenantId(tenantId);
            record.setFileName(dest.getFileName().toString());
            record.setFilePath(dest.toString());
            record.setFileSizeBytes(Files.size(dest));
            record.setStatus("success");
            record.setBackupType("manual");
            record.setCreatedBy(operatorId);
            backupMapper.insert(record);

            writeAudit(tenantId, "upload", record.getId(), operatorId, operatorIp,
                    "上传备份文件 " + record.getFileName());
            return toVO(record);
        } catch (IOException e) {
            throw new RuntimeException("上传失败: " + e.getMessage(), e);
        }
    }

    // ===== create backup =====

    public BackupRecord createBackup(Long operatorId, String operatorIp, String tenantId) {
        String ts = LocalDateTime.now().format(TS);

        BackupRecord record = new BackupRecord();
        record.setTenantId(tenantId);
        record.setFileName("backup_" + ts + ".tar.gz");
        record.setStatus("running");
        record.setBackupType("manual");
        record.setCreatedBy(operatorId);
        backupMapper.insert(record);

        Path work = null;
        try {
            Files.createDirectories(Paths.get(backupDir));
            work = Files.createTempDirectory(Paths.get(backupDir), "tmp-");

            // 1) pg_dump → dump.sql
            dumpDatabase(work.resolve("dump.sql"));
            // 2) MinIO objects → minio/<bucket>/<key>
            dumpMinio(work.resolve("minio"));
            // 3) tar -czf <backupDir>/<fileName> -C work .
            Path archive = Paths.get(backupDir, record.getFileName());
            runProcess(new ProcessBuilder("tar", "-czf", archive.toString(), "-C", work.toString(), "."), null);

            long size = Files.size(archive);
            BackupRecord ok = new BackupRecord();
            ok.setId(record.getId());
            ok.setFilePath(archive.toString());
            ok.setFileSizeBytes(size);
            ok.setStatus("success");
            backupMapper.updateById(ok);
            record.setFilePath(archive.toString());
            record.setFileSizeBytes(size);
            record.setStatus("success");

            writeAudit(tenantId, "create", record.getId(), operatorId, operatorIp,
                    "创建备份 " + record.getFileName() + " (" + size + " bytes)");
            autoRotate(tenantId);
        } catch (Exception e) {
            log.error("备份失败 id={}", record.getId(), e);
            BackupRecord fail = new BackupRecord();
            fail.setId(record.getId());
            fail.setStatus("failed");
            fail.setErrorMessage(truncate(e.getMessage(), 1000));
            backupMapper.updateById(fail);
            record.setStatus("failed");
            record.setErrorMessage(e.getMessage());
            writeAudit(tenantId, "create", record.getId(), operatorId, operatorIp,
                    "备份失败: " + truncate(e.getMessage(), 200));
        } finally {
            deleteQuietly(work);
        }
        return record;
    }

    private void dumpDatabase(Path target) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(
                "pg_dump", "-h", pgHost(), "-p", pgPort(), "-U", dbUser,
                "--clean", "--if-exists", "--no-owner", "--no-acl",
                "-f", target.toString(), pgDb());
        pb.environment().put("PGPASSWORD", dbPassword);
        runProcess(pb, "pg_dump");
    }

    private void dumpMinio(Path minioRoot) throws Exception {
        Files.createDirectories(minioRoot);
        for (Bucket bucket : minioClient.listBuckets()) {
            String name = bucket.name();
            Iterable<Result<Item>> objects = minioClient.listObjects(
                    ListObjectsArgs.builder().bucket(name).recursive(true).build());
            for (Result<Item> res : objects) {
                Item item = res.get();
                if (item.isDir()) continue;
                Path dest = minioRoot.resolve(name).resolve(item.objectName());
                Files.createDirectories(dest.getParent());
                try (InputStream in = minioClient.getObject(
                        GetObjectArgs.builder().bucket(name).object(item.objectName()).build())) {
                    Files.copy(in, dest, StandardCopyOption.REPLACE_EXISTING);
                }
            }
        }
    }

    // ===== restore =====

    public void restoreBackup(Long id, Long operatorId, String operatorIp, String tenantId) {
        BackupRecord record = findOrThrow(id, tenantId);
        if (!"success".equals(record.getStatus()) || record.getFilePath() == null) {
            throw new IllegalArgumentException("该备份不可用于恢复");
        }
        Path archive = Paths.get(record.getFilePath());
        if (!Files.exists(archive)) {
            throw new IllegalArgumentException("备份文件已丢失: " + record.getFilePath());
        }

        Path work = null;
        try {
            work = Files.createTempDirectory(Paths.get(backupDir), "restore-");
            // 1) extract
            runProcess(new ProcessBuilder("tar", "-xzf", archive.toString(), "-C", work.toString()), null);
            // 2) restore DB (dump 含 --clean --if-exists，单事务回放)
            Path dump = work.resolve("dump.sql");
            if (Files.exists(dump)) {
                ProcessBuilder pb = new ProcessBuilder(
                        "psql", "-h", pgHost(), "-p", pgPort(), "-U", dbUser,
                        "-d", pgDb(), "-v", "ON_ERROR_STOP=0", "-f", dump.toString());
                pb.environment().put("PGPASSWORD", dbPassword);
                runProcess(pb, "psql");
            }
            // 3) restore MinIO objects
            Path minioRoot = work.resolve("minio");
            if (Files.isDirectory(minioRoot)) {
                restoreMinio(minioRoot);
            }
            // 恢复后，将遗留的 running 记录标记为 failed（被中断的旧备份）
            backupMapper.update(null, new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<BackupRecord>()
                    .eq(BackupRecord::getTenantId, tenantId)
                    .eq(BackupRecord::getStatus, "running")
                    .set(BackupRecord::getStatus, "failed")
                    .set(BackupRecord::getErrorMessage, "进程被中断（已通过恢复操作自动清理）"));
            writeAudit(tenantId, "restore", id, operatorId, operatorIp,
                    "从备份恢复 " + record.getFileName());
        } catch (Exception e) {
            log.error("恢复失败 id={}", id, e);
            writeAudit(tenantId, "restore", id, operatorId, operatorIp,
                    "恢复失败: " + truncate(e.getMessage(), 200));
            throw new RuntimeException("恢复失败: " + e.getMessage(), e);
        } finally {
            deleteQuietly(work);
        }
    }

    private void restoreMinio(Path minioRoot) throws Exception {
        try (Stream<Path> bucketDirs = Files.list(minioRoot)) {
            for (Path bucketDir : (Iterable<Path>) bucketDirs::iterator) {
                if (!Files.isDirectory(bucketDir)) continue;
                String bucket = bucketDir.getFileName().toString();
                ensureBucket(bucket);
                clearBucket(bucket);
                try (Stream<Path> files = Files.walk(bucketDir)) {
                    for (Path file : (Iterable<Path>) files.filter(Files::isRegularFile)::iterator) {
                        String key = bucketDir.relativize(file).toString().replace('\\', '/');
                        minioClient.uploadObject(UploadObjectArgs.builder()
                                .bucket(bucket).object(key).filename(file.toString()).build());
                    }
                }
            }
        }
    }

    private void ensureBucket(String bucket) throws Exception {
        boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
        if (!exists) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
        }
    }

    private void clearBucket(String bucket) throws Exception {
        List<DeleteObject> toDelete = new ArrayList<>();
        for (Result<Item> res : minioClient.listObjects(
                ListObjectsArgs.builder().bucket(bucket).recursive(true).build())) {
            toDelete.add(new DeleteObject(res.get().objectName()));
        }
        if (toDelete.isEmpty()) return;
        for (Result<?> r : minioClient.removeObjects(
                RemoveObjectsArgs.builder().bucket(bucket).objects(toDelete).build())) {
            r.get(); // 触发执行，忽略单对象错误外的异常
        }
    }

    // ===== delete & rotation =====

    public void delete(Long id, Long operatorId, String operatorIp, String tenantId) {
        BackupRecord record = findOrThrow(id, tenantId);
        if (record.getFilePath() != null) {
            try {
                Files.deleteIfExists(Paths.get(record.getFilePath()));
            } catch (IOException e) {
                log.warn("删除备份文件失败 {}: {}", record.getFilePath(), e.getMessage());
            }
        }
        backupMapper.deleteById(id); // @TableLogic 软删
        writeAudit(tenantId, "delete", id, operatorId, operatorIp, "删除备份 " + record.getFileName());
    }

    /** 删除超过保留期的成功备份（物理删文件 + 逻辑删记录）。 */
    private void autoRotate(String tenantId) {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);
        List<BackupRecord> old = backupMapper.selectList(new LambdaQueryWrapper<BackupRecord>()
                .eq(BackupRecord::getTenantId, tenantId)
                .eq(BackupRecord::getIsDeleted, false)
                .lt(BackupRecord::getCreatedAt, cutoff));
        for (BackupRecord r : old) {
            if (r.getFilePath() != null) {
                try {
                    Files.deleteIfExists(Paths.get(r.getFilePath()));
                } catch (IOException e) {
                    log.warn("轮转删除文件失败 {}: {}", r.getFilePath(), e.getMessage());
                }
            }
            backupMapper.deleteById(r.getId());
        }
    }

    // ===== helpers =====

    private void runProcess(ProcessBuilder pb, String label) throws IOException, InterruptedException {
        pb.redirectErrorStream(true);
        Process p = pb.start();
        StringBuilder out = new StringBuilder();
        try (InputStream is = p.getInputStream()) {
            byte[] buf = is.readAllBytes();
            out.append(new String(buf));
        }
        int code = p.waitFor();
        if (code != 0) {
            throw new IOException((label != null ? label : "process") + " 退出码 " + code + ": " + truncate(out.toString(), 500));
        }
    }

    private void deleteQuietly(Path dir) {
        if (dir == null) return;
        try (Stream<Path> walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                try { Files.deleteIfExists(p); } catch (IOException ignored) {}
            });
        } catch (IOException e) {
            log.warn("清理临时目录失败 {}: {}", dir, e.getMessage());
        }
    }

    private String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    private void writeAudit(String tenantId, String action, Long targetId, Long operatorId,
                            String operatorIp, String remark) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId)
                .module("backup")
                .action(action)
                .targetId(targetId)
                .targetType("backup")
                .operatorId(operatorId)
                .operatorIp(operatorIp)
                .remark(remark)
                .createdAt(LocalDateTime.now())
                .build());
    }
}
