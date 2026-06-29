package com.cwgsyw.platform.module.sharedfile;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.changedoc.MinioStorageService;
import com.cwgsyw.platform.module.sharedfile.dto.SharedFileVO;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFile;
import com.cwgsyw.platform.module.user.UserMapper;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SharedFileService {

    private final SharedFileMapper fileMapper;
    private final SharedFolderService folderService;
    private final SharedFolderAclService aclService;
    private final MinioStorageService storageService;
    private final MinioClient minioClient;
    private final AuditLogMapper auditLogMapper;
    private final UserMapper userMapper;

    @Value("${minio.bucket}")
    private String bucket;

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
        boolean isAdmin = "tenant".equals(groupScope) || "platform".equals(groupScope);
        List<SharedFile> filtered = result.getRecords().stream()
                .filter(f -> isAdmin || f.getVisibleGroups() == null || f.getVisibleGroups().isEmpty()
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
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "unnamed";
        String fileType = detectFileType(originalName);
        String objectKey = "shared/" + UUID.randomUUID() + "/" + originalName;

        try {
            storageService.upload(objectKey, file.getInputStream(), file.getSize(), file.getContentType());
        } catch (IOException e) {
            throw new RuntimeException("文件上传失败: " + e.getMessage(), e);
        }

        SharedFile sf = new SharedFile();
        sf.setTenantId(tenantId);
        sf.setFolderId(folderId);
        sf.setName(originalName.contains(".") ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName);
        sf.setOriginalName(originalName);
        sf.setFileType(fileType);
        sf.setSizeBytes(file.getSize());
        sf.setMinioKey(objectKey);
        sf.setVisibleGroups(visibleGroups != null ? visibleGroups : List.of());
        sf.setCreatedBy(operatorId);
        sf.setCreatedAt(LocalDateTime.now());
        sf.setUpdatedAt(LocalDateTime.now());
        fileMapper.insert(sf);

        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("shared_file").action("upload")
                .targetId(sf.getId()).targetType("shared_file")
                .operatorId(operatorId).remark("name=" + originalName + " size=" + file.getSize())
                .createdAt(LocalDateTime.now()).build());

        if ("docx".equals(fileType)) {
            convertToMarkdownAsync(sf.getId(), objectKey, tenantId);
        }

        return toVO(sf, Map.of());
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

        fileMapper.deleteById(fileId);

        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("shared_file").action("delete")
                .targetId(fileId).targetType("shared_file")
                .operatorId(operatorId).remark("name=" + sf.getOriginalName())
                .createdAt(LocalDateTime.now()).build());
    }

    public String getPresignedUrl(String tenantId, Long fileId, int expirySeconds) {
        SharedFile sf = fileMapper.selectOne(new LambdaQueryWrapper<SharedFile>()
                .eq(SharedFile::getTenantId, tenantId)
                .eq(SharedFile::getId, fileId));
        if (sf == null) throw new IllegalArgumentException("文件不存在: " + fileId);
        try {
            return minioClient.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .bucket(bucket).object(sf.getMinioKey())
                    .method(Method.GET).expiry(expirySeconds, TimeUnit.SECONDS).build());
        } catch (Exception e) {
            throw new RuntimeException("生成预签名URL失败: " + e.getMessage(), e);
        }
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

    public SharedFileVO archiveFromChangeDoc(String tenantId, Long operatorId, Long changeDocId,
                                              byte[] wordBytes, byte[] pdfBytes, String docTitle) {
        return archiveDocPart(tenantId, operatorId, changeDocId, wordBytes, pdfBytes, docTitle, null);
    }

    /**
     * 双模板归档：每个 part（application / plan）调用一次。docTitle 通常会带后缀如
     * "{changeNo}_申请单"、"{changeNo}_方案"。{@code partLabel} 用作返回 VO 的辨识。
     */
    public SharedFileVO archiveDocPart(String tenantId, Long operatorId, Long changeDocId,
                                        byte[] wordBytes, byte[] pdfBytes, String docTitle, String partLabel) {
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
}
