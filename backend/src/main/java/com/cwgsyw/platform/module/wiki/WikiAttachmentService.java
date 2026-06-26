package com.cwgsyw.platform.module.wiki;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.changedoc.MinioStorageService;
import com.cwgsyw.platform.module.sharedfile.SharedFileMapper;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFile;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WikiAttachmentService {

    private final MinioStorageService minioStorage;
    private final SharedFileMapper sharedFileMapper;
    private final WikiPageMapper pageMapper;

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
        sharedFileMapper.insert(sf);
        return sf;
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
