package com.cwgsyw.platform.module.wiki;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.changedoc.MinioStorageService;
import com.cwgsyw.platform.module.sharedfile.SharedFileMapper;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFile;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import com.cwgsyw.platform.module.authorization.ResourceAuthorizationInitializer;
import com.cwgsyw.platform.module.authorization.ResourceDescriptorRepository;
import com.cwgsyw.platform.module.authorization.ResourceDescriptor;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.ArrayList;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@RequiredArgsConstructor
@Slf4j
public class WikiAttachmentService {

    private final MinioStorageService minioStorage;
    private final SharedFileMapper sharedFileMapper;
    private final WikiPageMapper pageMapper;
    private final ResourceAuthorizationInitializer resourceAuthorizationInitializer;
    private final ResourceDescriptorRepository resourceDescriptorRepository;
    private final AuditLogMapper auditLogMapper;

    public SharedFile uploadAttachment(String tenantId, Long userId, Long pageId, MultipartFile file) {
        WikiPage page = pageMapper.selectById(pageId);
        if (page == null) throw new IllegalArgumentException("页面不存在: " + pageId);

        String originalName = file.getOriginalFilename();
        String ext = "";
        if (originalName != null && originalName.contains(".")) {
            ext = originalName.substring(originalName.lastIndexOf('.'));
        }
        String uuid = UUID.randomUUID().toString().replace("-", "");
        String key = "wiki/" + page.getSpaceId() + "/attachments/" + uuid + ext;

        try {
            minioStorage.upload(key, file.getInputStream(), file.getSize(),
                    file.getContentType() != null ? file.getContentType() : "application/octet-stream");
        } catch (Exception e) {
            throw new RuntimeException("上传附件失败: " + e.getMessage(), e);
        }

        SharedFile sf = new SharedFile();
        sf.setTenantId(tenantId);
        sf.setName(uuid + ext);
        sf.setOriginalName(originalName);
        sf.setFileType(ext.isEmpty() ? "" : ext.substring(1));
        sf.setSizeBytes(file.getSize());
        sf.setMinioKey(key);
        sf.setSourceType("wiki_page");
        sf.setSourceId(pageId);
        sf.setCreatedBy(userId);
        sf.setCreatedAt(LocalDateTime.now());
        sf.setUpdatedAt(LocalDateTime.now());
        try {
            sharedFileMapper.insert(sf);
            ResourceDescriptor pageResource = resourceDescriptorRepository.find(tenantId, "wiki_page", pageId);
            resourceAuthorizationInitializer.initialize(tenantId, "shared_file", sf.getId(),
                userId, pageResource == null ? null : pageResource.getOwnerGroupId(), 0600);
        } catch (RuntimeException exception) {
            minioStorage.deleteOrThrow(key);
            throw exception;
        }
        return sf;
    }

    public Long attachmentPageId(String tenantId, Long fileId) {
        SharedFile file = sharedFileMapper.selectOne(new LambdaQueryWrapper<SharedFile>()
            .eq(SharedFile::getId, fileId)
            .eq(SharedFile::getTenantId, tenantId)
            .eq(SharedFile::getSourceType, "wiki_page"));
        if (file == null) throw new IllegalArgumentException("附件不存在: " + fileId);
        return file.getSourceId();
    }

    public void streamTo(String tenantId, Long fileId, HttpServletResponse response) throws Exception {
        SharedFile sf = sharedFileMapper.selectOne(new LambdaQueryWrapper<SharedFile>()
                .eq(SharedFile::getId, fileId)
                .eq(SharedFile::getTenantId, tenantId)
                .eq(SharedFile::getSourceType, "wiki_page"));
        if (sf == null) throw new IllegalArgumentException("附件不存在: " + fileId);

        String ext = sf.getFileType() != null ? sf.getFileType().toLowerCase() : "";
        response.setContentType(guessContentType(ext));
        response.setHeader("Cache-Control", "private, max-age=86400");
        try (InputStream is = minioStorage.download(sf.getMinioKey())) {
            is.transferTo(response.getOutputStream());
        }
    }

    public List<SharedFile> listAttachments(Long pageId) {
        return sharedFileMapper.selectList(new LambdaQueryWrapper<SharedFile>()
                .eq(SharedFile::getSourceType, "wiki_page")
                .eq(SharedFile::getSourceId, pageId));
    }

    @Transactional
    public void deleteAttachment(String tenantId, Long userId, Long fileId) {
        SharedFile attachment = requireAttachment(tenantId, fileId);
        deleteAttachmentsAtomically(List.of(attachment), userId);
    }

    public void deleteAttachmentsForPages(String tenantId, Long userId, List<Long> pageIds) {
        List<SharedFile> attachments = new ArrayList<>();
        for (Long pageId : pageIds) {
            attachments.addAll(sharedFileMapper.selectList(new LambdaQueryWrapper<SharedFile>()
                .eq(SharedFile::getTenantId, tenantId)
                .eq(SharedFile::getSourceType, "wiki_page")
                .eq(SharedFile::getSourceId, pageId)));
        }
        deleteAttachmentsAtomically(attachments, userId);
    }

    private SharedFile requireAttachment(String tenantId, Long fileId) {
        SharedFile attachment = sharedFileMapper.selectOne(new LambdaQueryWrapper<SharedFile>()
            .eq(SharedFile::getId, fileId)
            .eq(SharedFile::getTenantId, tenantId)
            .eq(SharedFile::getSourceType, "wiki_page"));
        if (attachment == null) throw new IllegalArgumentException("附件不存在: " + fileId);
        return attachment;
    }

    private void deleteAttachmentsAtomically(List<SharedFile> attachments, Long userId) {
        if (attachments.isEmpty()) return;
        String backupPrefix = "wiki/delete-backup/" + UUID.randomUUID() + "/";
        List<String> backups = new ArrayList<>();
        try {
            for (SharedFile attachment : attachments) {
                String backupKey = backupPrefix + attachment.getId();
                minioStorage.copyOrThrow(attachment.getMinioKey(), backupKey);
                backups.add(backupKey);
            }
            for (SharedFile attachment : attachments) minioStorage.deleteOrThrow(attachment.getMinioKey());
        } catch (RuntimeException exception) {
            restoreAttachments(backups, attachments, exception);
            throw exception;
        }
        registerAttachmentCleanup(backups, attachments);
        for (SharedFile attachment : attachments) {
            sharedFileMapper.deleteById(attachment.getId());
            auditLogMapper.insert(AuditLog.builder()
                .tenantId(attachment.getTenantId()).module("wiki").action("delete_attachment")
                .targetId(attachment.getId()).targetType("shared_file").operatorId(userId)
                .remark("pageId=" + attachment.getSourceId() + ",name=" + attachment.getOriginalName())
                .createdAt(LocalDateTime.now()).build());
        }
    }

    private void registerAttachmentCleanup(List<String> backups, List<SharedFile> attachments) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status != STATUS_COMMITTED) restoreAttachments(backups, attachments, null);
                    for (String backup : backups) minioStorage.delete(backup);
                }
            });
        } else {
            for (String backup : backups) minioStorage.delete(backup);
        }
    }

    private void restoreAttachments(List<String> backups, List<SharedFile> attachments, RuntimeException originalFailure) {
        for (int index = 0; index < backups.size(); index++) {
            try {
                minioStorage.copyOrThrow(backups.get(index), attachments.get(index).getMinioKey());
            } catch (RuntimeException restoreFailure) {
                if (originalFailure != null) originalFailure.addSuppressed(restoreFailure);
                else log.error("恢复 Wiki 附件失败 fileId={}", attachments.get(index).getId(), restoreFailure);
            }
        }
    }

    private String guessContentType(String ext) {
        return switch (ext) {
            case "png" -> "image/png";
            case "jpg", "jpeg" -> "image/jpeg";
            case "gif" -> "image/gif";
            case "webp" -> "image/webp";
            case "svg" -> "image/svg+xml";
            default -> "application/octet-stream";
        };
    }
}
