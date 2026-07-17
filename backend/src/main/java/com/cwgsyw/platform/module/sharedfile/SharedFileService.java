package com.cwgsyw.platform.module.sharedfile;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.AuditSnapshotSerializer;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.changedoc.MinioStorageService;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.sharedfile.dto.SharedFileVO;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFile;
import com.cwgsyw.platform.module.user.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.time.LocalDateTime;
import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;
import com.cwgsyw.platform.module.authorization.AuthorizationResourceMigrationService;
import com.cwgsyw.platform.module.authorization.AuthorizationService;
import com.cwgsyw.platform.security.SecurityUser;

@Service
@RequiredArgsConstructor
@Slf4j
public class SharedFileService {

    private static final long MAX_UPLOAD_SIZE_BYTES = 20L * 1024 * 1024;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
        "7z", "bash", "bat", "bmp", "bz2", "cmd", "conf", "csv", "doc", "docx", "dot", "dotx",
        "env", "gif", "gz", "ini", "jpeg", "jpg", "json", "md", "mjs", "odt", "ods", "pdf",
        "png", "pot", "potx", "pps", "ppsx", "ppt", "pptx", "properties", "ps1", "rar", "rtf",
        "sh", "svg", "tar", "tif", "tiff", "tgz", "txt", "webp", "xls", "xlsb", "xlsm", "xlsx",
        "xml", "xz", "yaml", "yml", "zsh", "zip"
    );

    private final SharedFileMapper fileMapper;
    private final SharedFolderService folderService;
    private final SharedFolderAclService aclService;
    private final MinioStorageService storageService;
    private final AuditLogMapper auditLogMapper;
    private final AuditSnapshotSerializer auditSnapshotSerializer;
    private final UserMapper userMapper;
    private final AuthorizationResourceMigrationService resourceMigrationService;
    private final AuthorizationService authorizationService;
    private final ActiveGroupReferenceValidator activeGroupReferenceValidator;

    public PageResult<SharedFileVO> listFiles(String tenantId, Long folderId, String keyword,
                                              SecurityUser user, int page, int size) {
        boolean enforced = authorizationService.isEnforced(user, "shared_file");
        PageResult<SharedFileVO> result = enforced
            ? queryFiles(tenantId, folderId, keyword, null, null, page, size)
            : listFiles(tenantId, folderId, keyword, user.getUserId(),
                user.getGroupId(), user.getGroupScope(), page, size);
        if (!enforced) {
            applyCapabilities(result, user);
            return result;
        }
        List<SharedFileVO> allowed = result.getRecords().stream()
            .filter(file -> authorizationService.decide(user, "shared_file:read", "shared_file", file.getId(), 4)
                .isAllowed())
            .toList();
        result.setRecords(allowed);
        result.setTotal(allowed.size());
        applyCapabilities(result, user);
        return result;
    }

    private void applyCapabilities(PageResult<SharedFileVO> result, SecurityUser user) {
        boolean legacyDelete = user.getPermissions().contains("shared_file:delete");
        boolean legacyManageAcl = user.getPermissions().contains("shared_file:manage_acl");
        for (SharedFileVO file : result.getRecords()) {
            file.setCanDelete(authorizationService.decideParentWithCompatibility(user, "shared_file",
                "shared_file:delete", "shared_file", file.getId(), 3, legacyDelete));
            file.setCanManageAcl(authorizationService.decideWithCompatibility(user, "shared_file",
                "shared_file:manage_acl", "shared_file", file.getId(), 2, legacyManageAcl));
        }
    }

    public PageResult<SharedFileVO> listFiles(String tenantId, Long folderId, String keyword,
                                               Long userId, Long userGroupId, String groupScope, int page, int size) {
        // 文件夹 ACL：无 read 权限直接返回空列表（搜索为全局，folderId 为空时不限制）
        if (folderId != null && !aclService.hasPermission(tenantId, folderId, userId, userGroupId, groupScope, "read")) {
            PageResult<SharedFileVO> empty = new PageResult<>();
            empty.setRecords(List.of());
            empty.setTotal(0);
            empty.setPage(page);
            empty.setSize(size);
            return empty;
        }
        return queryFiles(tenantId, folderId, keyword, userGroupId, groupScope, page, size);
    }

    private PageResult<SharedFileVO> queryFiles(String tenantId, Long folderId, String keyword,
                                                Long userGroupId, String groupScope, int page, int size) {
        Page<SharedFile> result;
        long total;

        if (StringUtils.hasText(keyword)) {
            total = fileMapper.selectCount(new LambdaQueryWrapper<SharedFile>()
                    .eq(SharedFile::getTenantId, tenantId)
                    .and(w -> w.isNull(SharedFile::getSourceType).or().ne(SharedFile::getSourceType, "wiki_page"))
                    .apply("to_tsvector('simple', name) @@ plainto_tsquery('simple', {0})", keyword));
            result = fileMapper.searchByKeyword(new Page<>(page, size, false), tenantId, keyword);
        } else {
            LambdaQueryWrapper<SharedFile> qw = new LambdaQueryWrapper<SharedFile>()
                    .eq(SharedFile::getTenantId, tenantId)
                    .eq(folderId != null, SharedFile::getFolderId, folderId)
                    .isNull(folderId == null, SharedFile::getFolderId)
                    // 排除 wiki 页面内嵌附件（无 folder，否则会堆在根目录显示）
                    .and(w -> w.isNull(SharedFile::getSourceType).or().ne(SharedFile::getSourceType, "wiki_page"))
                    .orderByDesc(SharedFile::getCreatedAt);
            total = fileMapper.selectCount(new LambdaQueryWrapper<SharedFile>()
                    .eq(SharedFile::getTenantId, tenantId)
                    .eq(folderId != null, SharedFile::getFolderId, folderId)
                    .isNull(folderId == null, SharedFile::getFolderId)
                    .and(w -> w.isNull(SharedFile::getSourceType).or().ne(SharedFile::getSourceType, "wiki_page")));
            result = fileMapper.selectPage(new Page<>(page, size, false), qw);
        }
        result.setTotal(total);

        // Filter by visibility
        boolean unifiedAuthorization = groupScope == null;
        boolean isAdmin = "tenant".equals(groupScope) || "platform".equals(groupScope);
        List<SharedFile> filtered = result.getRecords().stream()
                .filter(f -> unifiedAuthorization || isAdmin || f.getVisibleGroups() == null || f.getVisibleGroups().isEmpty()
                        || f.getVisibleGroups().contains(userGroupId))
                .collect(Collectors.toList());

        // Resolve creator names
        Set<Long> userIds = filtered.stream().map(SharedFile::getCreatedBy).collect(Collectors.toSet());
        Map<Long, String> nameMap = userIds.isEmpty() ? Map.of() :
                userMapper.selectBatchIds(userIds).stream()
                        .collect(Collectors.toMap(
                                com.cwgsyw.platform.module.user.entity.User::getId,
                                u -> u.getRealName() != null ? u.getRealName() : u.getUsername()));

        List<SharedFileVO> vos = filtered.stream().map(f -> toVO(f, nameMap)).collect(Collectors.toList());

        PageResult<SharedFileVO> pr = new PageResult<>();
        pr.setRecords(vos);
        pr.setTotal(total);
        pr.setPage(page);
        pr.setSize(size);
        return pr;
    }

    @Transactional
    public SharedFileVO uploadFile(String tenantId, Long operatorId, MultipartFile file,
                                    Long folderId, List<Long> visibleGroups,
                                    Long groupId, String groupScope) {
        if (folderId != null && !aclService.hasPermission(tenantId, folderId, operatorId, groupId, groupScope, "write")) {
            throw new IllegalStateException("无权在该文件夹上传文件");
        }
        return uploadFileUnchecked(tenantId, operatorId, file, folderId, visibleGroups, groupId);
    }

    private SharedFileVO uploadFileUnchecked(String tenantId, Long operatorId, MultipartFile file,
                                             Long folderId, List<Long> visibleGroups, Long groupId) {
        List<Long> normalizedVisibleGroups = lockReferencedGroups(tenantId, groupId, visibleGroups);
        String originalName = normalizeOriginalName(file);
        String normalizedName = normalizedName(originalName);
        rejectNameConflict(tenantId, folderId, normalizedName, null);
        String fileType = detectFileType(originalName);
        String objectKey = "shared/" + UUID.randomUUID() + "/" + originalName;

        try {
            storageService.upload(objectKey, file.getInputStream(), file.getSize(), file.getContentType());
        } catch (IOException e) {
            throw new RuntimeException("文件上传失败: " + e.getMessage(), e);
        } catch (RuntimeException e) {
            storageService.delete(objectKey);
            throw e;
        }

        SharedFile sf = new SharedFile();
        sf.setTenantId(tenantId);
        sf.setFolderId(folderId);
        sf.setName(originalName.contains(".") ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName);
        sf.setOriginalName(originalName);
        sf.setNormalizedName(normalizedName);
        sf.setFileType(fileType);
        sf.setSizeBytes(file.getSize());
        sf.setMinioKey(objectKey);
        sf.setVisibleGroups(normalizedVisibleGroups);
        sf.setCreatedBy(operatorId);
        sf.setCreatedAt(LocalDateTime.now());
        sf.setUpdatedAt(LocalDateTime.now());
        try {
            fileMapper.insert(sf);
            resourceMigrationService.initializeCreatedResource(tenantId, "shared_file", sf.getId(),
                operatorId, groupId, 0660);

            auditLogMapper.insert(AuditLog.builder()
                    .tenantId(tenantId).module("shared_file").action("upload")
                    .targetId(sf.getId()).targetType("shared_file")
                    .afterJson(fileSnapshot(sf))
                    .operatorId(operatorId).remark("name=" + originalName + " size=" + file.getSize())
                    .createdAt(LocalDateTime.now()).build());
        } catch (DataIntegrityViolationException exception) {
            storageService.delete(objectKey);
            throw new BusinessException(409, "SHARED_FILE_NAME_CONFLICT", "当前目录已存在同名文件");
        } catch (RuntimeException exception) {
            storageService.delete(objectKey);
            throw exception;
        }

        if ("docx".equals(fileType)) {
            convertToMarkdownAsync(sf.getId(), objectKey, tenantId);
        }

        return toVO(sf, Map.of());
    }

    @Transactional
    public SharedFileVO uploadFile(SecurityUser user, MultipartFile file, Long folderId,
                                   List<Long> visibleGroups, Long ownerGroupId) {
        if (authorizationService.isEnforced(user, "shared_file")) {
            return uploadFileUnchecked(user.getTenantId(), user.getUserId(), file, folderId,
                visibleGroups, ownerGroupId);
        }
        return uploadFile(user.getTenantId(), user.getUserId(), file, folderId, visibleGroups,
            ownerGroupId, user.getGroupScope());
    }

    public SharedFileVO getFile(String tenantId, Long fileId) {
        SharedFile sf = fileMapper.selectOne(new LambdaQueryWrapper<SharedFile>()
                .eq(SharedFile::getTenantId, tenantId)
                .eq(SharedFile::getId, fileId));
        if (sf == null) throw new IllegalArgumentException("文件不存在: " + fileId);
        String creatorName = userMapper.selectById(sf.getCreatedBy()) != null
                ? userMapper.selectById(sf.getCreatedBy()).getRealName() : null;
        return toVO(sf, Map.of(sf.getCreatedBy(), creatorName != null ? creatorName : String.valueOf(sf.getCreatedBy())));
    }

    @Transactional
    public void deleteFile(String tenantId, Long fileId, Long operatorId, Long groupId, String groupScope) {
        SharedFile sf = fileMapper.selectOne(new LambdaQueryWrapper<SharedFile>()
                .eq(SharedFile::getTenantId, tenantId)
                .eq(SharedFile::getId, fileId));
        if (sf == null) throw new IllegalArgumentException("文件不存在: " + fileId);

        if (sf.getFolderId() != null
                && !aclService.hasPermission(tenantId, sf.getFolderId(), operatorId, groupId, groupScope, "delete")) {
            throw new IllegalStateException("无权删除该文件夹下的文件");
        }
        deleteFileUnchecked(tenantId, fileId, operatorId);
    }

    private void deleteFileUnchecked(String tenantId, Long fileId, Long operatorId) {
        SharedFile sf = fileMapper.selectOne(new LambdaQueryWrapper<SharedFile>()
                .eq(SharedFile::getTenantId, tenantId)
                .eq(SharedFile::getId, fileId));
        if (sf == null) throw new IllegalArgumentException("文件不存在: " + fileId);
        String before = fileSnapshot(sf);
        List<String> objectKeys = new ArrayList<>();
        objectKeys.add(sf.getMinioKey());
        if (StringUtils.hasText(sf.getMdKey())) objectKeys.add(sf.getMdKey());
        String backupPrefix = "shared/delete-backup/" + UUID.randomUUID() + "/";
        List<String> backupKeys = new ArrayList<>();
        try {
            for (int index = 0; index < objectKeys.size(); index++) {
                String backupKey = backupPrefix + index;
                storageService.copyOrThrow(objectKeys.get(index), backupKey);
                backupKeys.add(backupKey);
            }
            for (String objectKey : objectKeys) storageService.deleteOrThrow(objectKey);
        } catch (RuntimeException exception) {
            restoreObjects(backupKeys, objectKeys, exception);
            throw exception;
        }
        registerObjectCleanup(backupKeys, objectKeys);
        fileMapper.deleteById(fileId);

        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("shared_file").action("delete")
                .targetId(fileId).targetType("shared_file")
                .beforeJson(before)
                .operatorId(operatorId).remark("name=" + sf.getOriginalName())
                .createdAt(LocalDateTime.now()).build());

    }

    private void registerObjectCleanup(List<String> backupKeys, List<String> objectKeys) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status != STATUS_COMMITTED) restoreObjects(backupKeys, objectKeys, null);
                    for (String backupKey : backupKeys) storageService.delete(backupKey);
                }
            });
        } else {
            for (String backupKey : backupKeys) storageService.delete(backupKey);
        }
    }

    private void restoreObjects(List<String> backupKeys, List<String> objectKeys, RuntimeException originalFailure) {
        for (int index = 0; index < backupKeys.size(); index++) {
            try {
                storageService.copyOrThrow(backupKeys.get(index), objectKeys.get(index));
            } catch (RuntimeException restoreFailure) {
                if (originalFailure != null) originalFailure.addSuppressed(restoreFailure);
                else log.error("恢复共享文件对象失败 key={}", objectKeys.get(index), restoreFailure);
            }
        }
    }

    @Transactional
    public void deleteFile(SecurityUser user, Long fileId) {
        if (authorizationService.isEnforced(user, "shared_file")) {
            deleteFileUnchecked(user.getTenantId(), fileId, user.getUserId());
            return;
        }
        deleteFile(user.getTenantId(), fileId, user.getUserId(), user.getGroupId(), user.getGroupScope());
    }

    @Transactional
    public SharedFileVO renameFile(SecurityUser user, Long fileId, String name) {
        return updateFile(user, fileId, name, null, false);
    }

    @Transactional
    public SharedFileVO updateFile(SecurityUser user, Long fileId, String requestedName, Long requestedFolderId,
                                   boolean moveRequested) {
        SharedFile file = fileMapper.selectOne(new LambdaQueryWrapper<SharedFile>()
                .eq(SharedFile::getTenantId, user.getTenantId())
                .eq(SharedFile::getId, fileId));
        if (file == null) throw new IllegalArgumentException("文件不存在: " + fileId);

        Long folderId = moveRequested ? requestedFolderId : file.getFolderId();
        if (moveRequested && folderId != null) folderService.getFolder(user.getTenantId(), folderId);
        String displayName = requestedName == null ? file.getName() : normalizeDisplayName(requestedName);
        String extension = "";
        int dot = file.getOriginalName().lastIndexOf('.');
        if (dot > 0) extension = file.getOriginalName().substring(dot);
        String originalName = displayName + extension;
        String normalizedName = normalizedName(originalName);
        rejectNameConflict(user.getTenantId(), folderId, normalizedName, fileId);
        String before = fileSnapshot(file);
        boolean renamed = !Objects.equals(file.getName(), displayName);
        boolean moved = moveRequested && !Objects.equals(file.getFolderId(), folderId);
        if (!renamed && !moved) return toVO(file, Map.of());
        file.setName(displayName);
        file.setOriginalName(originalName);
        file.setNormalizedName(normalizedName);
        file.setFolderId(folderId);
        file.setUpdatedAt(LocalDateTime.now());
        try {
            fileMapper.updateById(file);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(409, "SHARED_FILE_NAME_CONFLICT", "当前目录已存在同名文件");
        }
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(user.getTenantId()).module("shared_file").action(moved ? "move" : "update")
                .targetId(fileId).targetType("shared_file").operatorId(user.getUserId())
                .beforeJson(before)
                .afterJson(fileSnapshot(file))
                .createdAt(LocalDateTime.now()).build());
        return toVO(file, Map.of());
    }

    public FileContent getFileContent(String tenantId, Long fileId) {
        SharedFile sf = fileMapper.selectOne(new LambdaQueryWrapper<SharedFile>()
                .eq(SharedFile::getTenantId, tenantId)
                .eq(SharedFile::getId, fileId));
        if (sf == null) throw new IllegalArgumentException("文件不存在: " + fileId);
        long actualSize = storageService.objectSize(sf.getMinioKey());
        return new FileContent(sf.getOriginalName(), actualSize, storageService.download(sf.getMinioKey()));
    }

    private String fileSnapshot(SharedFile file) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("id", file.getId());
        values.put("folderId", file.getFolderId());
        values.put("name", file.getName());
        values.put("originalName", file.getOriginalName());
        values.put("fileType", file.getFileType());
        values.put("sizeBytes", file.getSizeBytes());
        values.put("visibleGroups", file.getVisibleGroups() == null ? List.of() : file.getVisibleGroups());
        values.put("sourceType", file.getSourceType());
        values.put("sourceId", file.getSourceId());
        return auditSnapshotSerializer.serialize(values);
    }

    public record FileContent(String originalName, long sizeBytes, InputStream stream) {
    }

    @Async
    public void convertToMarkdownAsync(Long fileId, String minioKey, String tenantId) {
        try {
            InputStream docxStream = storageService.download(minioKey);
            File tempDocx = File.createTempFile("shared_", ".docx");
            File tempMd = File.createTempFile("shared_", ".md");
            try (FileOutputStream fos = new FileOutputStream(tempDocx)) {
                docxStream.transferTo(fos);
            }

            ProcessBuilder pb = new ProcessBuilder("pandoc", tempDocx.getAbsolutePath(), "-o", tempMd.getAbsolutePath());
            Process proc = pb.start();
            int exitCode = proc.waitFor();
            if (exitCode != 0) {
                log.warn("pandoc conversion failed for file {}, exit code: {}", fileId, exitCode);
                return;
            }

            String mdKey = minioKey.replace(".docx", ".md");
            try (FileInputStream fis = new FileInputStream(tempMd)) {
                storageService.upload(mdKey, fis, tempMd.length(), "text/markdown");
            }

            fileMapper.update(null, new LambdaUpdateWrapper<SharedFile>()
                    .eq(SharedFile::getId, fileId)
                    .set(SharedFile::getMdKey, mdKey));

            tempDocx.delete();
            tempMd.delete();
        } catch (Exception e) {
            log.error("Markdown conversion failed for file {}: {}", fileId, e.getMessage());
        }
    }

    @Transactional
    public SharedFileVO archiveFromChangeDoc(String tenantId, Long operatorId, Long changeDocId,
                                              byte[] wordBytes, byte[] pdfBytes, String docTitle) {
        return archiveDocPart(tenantId, operatorId, changeDocId, wordBytes, pdfBytes, docTitle, null);
    }

    /**
     * 双模板归档：每个 part（application / plan）调用一次。docTitle 通常会带后缀如
     * "{changeNo}_申请单"、"{changeNo}_方案"。{@code partLabel} 用作返回 VO 的辨识。
     */
    @Transactional
    public SharedFileVO archiveDocPart(String tenantId, Long operatorId, Long changeDocId,
                                        byte[] wordBytes, byte[] pdfBytes, String docTitle, String partLabel) {
        Long ownerGroupId = primaryGroupId(operatorId);
        lockReferencedGroups(tenantId, ownerGroupId, List.of());
        String monthFolder = "变更文档/" + java.time.YearMonth.now().toString();
        var folder = folderService.getOrCreateFolder(tenantId, operatorId, monthFolder);

        // partLabel 计入 minio key 路径，避免不同 part 写到同一个 key 互相覆盖
        String pathSuffix = (partLabel != null && !partLabel.isBlank()) ? "/" + partLabel : "";

        // Upload Word
        String wordKey = "shared/changedoc/" + changeDocId + pathSuffix + "/" + docTitle + ".docx";
        storageService.upload(wordKey, new ByteArrayInputStream(wordBytes), wordBytes.length,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

        // Upload PDF
        String pdfKey = "shared/changedoc/" + changeDocId + pathSuffix + "/" + docTitle + ".pdf";
        storageService.upload(pdfKey, new ByteArrayInputStream(pdfBytes), pdfBytes.length, "application/pdf");

        // Save Word file record
        SharedFile wordFile = new SharedFile();
        wordFile.setTenantId(tenantId);
        wordFile.setFolderId(folder.getId());
        wordFile.setName(docTitle);
        wordFile.setOriginalName(docTitle + ".docx");
        wordFile.setFileType("docx");
        wordFile.setSizeBytes((long) wordBytes.length);
        wordFile.setMinioKey(wordKey);
        wordFile.setVisibleGroups(List.of());
        wordFile.setSourceType("change_doc");
        wordFile.setSourceId(changeDocId);
        wordFile.setCreatedBy(operatorId);
        wordFile.setCreatedAt(LocalDateTime.now());
        wordFile.setUpdatedAt(LocalDateTime.now());
        fileMapper.insert(wordFile);
        resourceMigrationService.initializeCreatedResource(tenantId, "shared_file", wordFile.getId(),
            operatorId, ownerGroupId, 0660);

        // Save PDF file record
        SharedFile pdfFile = new SharedFile();
        pdfFile.setTenantId(tenantId);
        pdfFile.setFolderId(folder.getId());
        pdfFile.setName(docTitle + " (PDF)");
        pdfFile.setOriginalName(docTitle + ".pdf");
        pdfFile.setFileType("pdf");
        pdfFile.setSizeBytes((long) pdfBytes.length);
        pdfFile.setMinioKey(pdfKey);
        pdfFile.setVisibleGroups(List.of());
        pdfFile.setSourceType("change_doc");
        pdfFile.setSourceId(changeDocId);
        pdfFile.setCreatedBy(operatorId);
        pdfFile.setCreatedAt(LocalDateTime.now());
        pdfFile.setUpdatedAt(LocalDateTime.now());
        fileMapper.insert(pdfFile);
        resourceMigrationService.initializeCreatedResource(tenantId, "shared_file", pdfFile.getId(),
            operatorId, ownerGroupId, 0660);

        convertToMarkdownAsync(wordFile.getId(), wordKey, tenantId);

        return toVO(wordFile, Map.of());
    }

    private SharedFileVO toVO(SharedFile f, Map<Long, String> nameMap) {
        SharedFileVO vo = new SharedFileVO();
        vo.setId(f.getId());
        vo.setFolderId(f.getFolderId());
        vo.setName(f.getName());
        vo.setOriginalName(f.getOriginalName());
        vo.setFileType(f.getFileType());
        vo.setSizeBytes(f.getSizeBytes());
        vo.setMdKey(f.getMdKey());
        vo.setVisibleGroups(f.getVisibleGroups());
        vo.setSourceType(f.getSourceType());
        vo.setSourceId(f.getSourceId());
        vo.setCreatedBy(f.getCreatedBy());
        vo.setCreatedByName(nameMap.getOrDefault(f.getCreatedBy(), String.valueOf(f.getCreatedBy())));
        vo.setCreatedAt(f.getCreatedAt());
        return vo;
    }

    private String detectFileType(String filename) {
        if (filename == null) return "other";
        String lower = filename.toLowerCase();
        if (lower.endsWith(".pdf")) return "pdf";
        if (lower.endsWith(".docx")) return "docx";
        if (lower.endsWith(".doc")) return "doc";
        if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "xlsx";
        return "other";
    }

    private String normalizeOriginalName(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() <= 0) {
            throw BusinessException.badRequest("SHARED_FILE_EMPTY", "不允许上传空文件");
        }
        if (file.getSize() > MAX_UPLOAD_SIZE_BYTES) {
            throw BusinessException.badRequest("SHARED_FILE_TOO_LARGE", "文件大小不能超过20MB");
        }
        String originalName = file.getOriginalFilename();
        if (originalName == null) {
            throw BusinessException.badRequest("SHARED_FILE_NAME_INVALID", "文件名不能为空");
        }
        String normalized = normalizeDisplayName(originalName);
        if (normalized.length() > 255 || normalized.contains("/") || normalized.contains("\\")
                || normalized.chars().anyMatch(Character::isISOControl)) {
            throw BusinessException.badRequest("SHARED_FILE_NAME_INVALID", "文件名格式不合法");
        }
        int dot = normalized.lastIndexOf('.');
        if (dot <= 0 || dot == normalized.length() - 1) {
            throw BusinessException.badRequest("SHARED_FILE_TYPE_UNSUPPORTED", "文件类型不在允许范围内");
        }
        String extension = normalized.substring(dot + 1).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw BusinessException.badRequest("SHARED_FILE_TYPE_UNSUPPORTED", "文件类型不在允许范围内");
        }
        return normalized;
    }

    private String normalizeDisplayName(String name) {
        if (name == null) throw BusinessException.badRequest("SHARED_FILE_NAME_INVALID", "文件名不能为空");
        String normalized = Normalizer.normalize(name, Normalizer.Form.NFC).trim();
        if (normalized.isEmpty()) throw BusinessException.badRequest("SHARED_FILE_NAME_INVALID", "文件名不能为空");
        return normalized;
    }

    private String normalizedName(String originalName) {
        return Normalizer.normalize(originalName, Normalizer.Form.NFC).trim().toLowerCase(Locale.ROOT);
    }

    private void rejectNameConflict(String tenantId, Long folderId, String normalizedName, Long excludedFileId) {
        fileMapper.lockActiveNormalizedName(tenantId + ":" + (folderId == null ? "ROOT" : folderId) + ":" + normalizedName);
        long count = fileMapper.selectCount(new LambdaQueryWrapper<SharedFile>()
            .eq(SharedFile::getTenantId, tenantId)
            .eq(folderId != null, SharedFile::getFolderId, folderId)
            .isNull(folderId == null, SharedFile::getFolderId)
            .eq(SharedFile::getNormalizedName, normalizedName)
            .isNull(SharedFile::getSourceType)
            .ne(excludedFileId != null, SharedFile::getId, excludedFileId));
        if (count > 0) {
            throw new BusinessException(409, "SHARED_FILE_NAME_CONFLICT", "当前目录已存在同名文件");
        }
    }

    private Long primaryGroupId(Long userId) {
        if (userId == null) return null;
        var user = userMapper.selectById(userId);
        return user == null ? null : user.getGroupId();
    }

    private List<Long> lockReferencedGroups(String tenantId, Long ownerGroupId,
                                            List<Long> visibleGroups) {
        SortedSet<Long> groupIds = new TreeSet<>();
        if (ownerGroupId != null) groupIds.add(ownerGroupId);
        if (visibleGroups != null) {
            if (visibleGroups.stream().anyMatch(Objects::isNull)) {
                throw new IllegalArgumentException("可见用户组不能包含空值");
            }
            groupIds.addAll(visibleGroups);
        }
        groupIds.forEach(groupId -> activeGroupReferenceValidator.lockAndRequire(tenantId, groupId));
        if (visibleGroups == null || visibleGroups.isEmpty()) return List.of();
        return visibleGroups.stream().distinct().sorted().toList();
    }
}
