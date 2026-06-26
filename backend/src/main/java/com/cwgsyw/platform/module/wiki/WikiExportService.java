package com.cwgsyw.platform.module.wiki;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.changedoc.MinioStorageService;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFile;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import com.cwgsyw.platform.module.wiki.entity.WikiSpace;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
public class WikiExportService {

    private final WikiPageMapper pageMapper;
    private final WikiSpaceMapper spaceMapper;
    private final WikiAttachmentService attachmentService;
    private final MinioStorageService minioStorage;

    private static final Pattern ATT_PATTERN = Pattern.compile("/api/wiki/attachments/(\\d+)");

    public void exportPage(Long pageId, String tenantId, HttpServletResponse response) throws Exception {
        WikiPage page = pageMapper.selectById(pageId);
        if (page == null) throw new IllegalArgumentException("页面不存在");

        List<SharedFile> attachments = attachmentService.listAttachments(pageId);
        Map<Long, SharedFile> attById = new LinkedHashMap<>();
        for (SharedFile sf : attachments) attById.put(sf.getId(), sf);

        Map<Long, String> fileNameMap = new LinkedHashMap<>();
        Matcher m = ATT_PATTERN.matcher(page.getContent() != null ? page.getContent() : "");
        while (m.find()) {
            Long fid = Long.parseLong(m.group(1));
            SharedFile sf = attById.get(fid);
            if (sf != null) fileNameMap.put(fid, sf.getOriginalName() != null ? sf.getOriginalName() : sf.getName());
        }

        String filename = sanitizeFilename(page.getTitle()) + ".md";
        if (fileNameMap.isEmpty()) {
            response.setContentType("text/markdown;charset=UTF-8");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
            response.getOutputStream().write(
                    (page.getContent() != null ? page.getContent() : "").getBytes(StandardCharsets.UTF_8));
        } else {
            String rewritten = rewriteImageUrls(page.getContent(), fileNameMap);
            response.setContentType("application/zip");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + sanitizeFilename(page.getTitle()) + ".zip\"");
            try (ZipOutputStream zos = new ZipOutputStream(response.getOutputStream())) {
                putZipEntry(zos, filename, rewritten.getBytes(StandardCharsets.UTF_8));
                for (Map.Entry<Long, String> e : fileNameMap.entrySet()) {
                    SharedFile sf = attById.get(e.getKey());
                    if (sf == null) continue;
                    try (InputStream is = minioStorage.download(sf.getMinioKey())) {
                        zos.putNextEntry(new ZipEntry("images/" + e.getValue()));
                        is.transferTo(zos);
                        zos.closeEntry();
                    }
                }
            }
        }
    }

    public void exportSpace(Long spaceId, String tenantId, HttpServletResponse response) throws Exception {
        WikiSpace space = spaceMapper.selectById(spaceId);
        if (space == null) throw new IllegalArgumentException("空间不存在");

        List<WikiPage> pages = pageMapper.selectList(new LambdaQueryWrapper<WikiPage>()
                .eq(WikiPage::getTenantId, tenantId)
                .eq(WikiPage::getSpaceId, spaceId)
                .orderByAsc(WikiPage::getSortOrder));

        Map<Long, WikiPage> allById = new LinkedHashMap<>();
        for (WikiPage p : pages) allById.put(p.getId(), p);

        response.setContentType("application/zip");
        response.setHeader("Content-Disposition",
                "attachment; filename=\"" + sanitizeFilename(space.getName()) + ".zip\"");

        Set<String> addedImages = new HashSet<>();
        try (ZipOutputStream zos = new ZipOutputStream(response.getOutputStream())) {
            for (WikiPage page : pages) {
                List<SharedFile> attachments = attachmentService.listAttachments(page.getId());
                Map<Long, SharedFile> attById = new LinkedHashMap<>();
                for (SharedFile sf : attachments) attById.put(sf.getId(), sf);

                Map<Long, String> fileNameMap = new LinkedHashMap<>();
                Matcher m = ATT_PATTERN.matcher(page.getContent() != null ? page.getContent() : "");
                while (m.find()) {
                    Long fid = Long.parseLong(m.group(1));
                    SharedFile sf = attById.get(fid);
                    if (sf != null) fileNameMap.put(fid, sf.getOriginalName() != null ? sf.getOriginalName() : sf.getName());
                }

                String dir = buildZipPath(allById, page);
                String mdPath = dir + sanitizeFilename(page.getTitle()) + ".md";
                String content = rewriteImageUrls(page.getContent(), fileNameMap);
                putZipEntry(zos, mdPath, content.getBytes(StandardCharsets.UTF_8));

                for (Map.Entry<Long, String> e : fileNameMap.entrySet()) {
                    String imagePath = "images/" + e.getValue();
                    if (addedImages.contains(imagePath)) continue;
                    SharedFile sf = attById.get(e.getKey());
                    if (sf == null) continue;
                    try (InputStream is = minioStorage.download(sf.getMinioKey())) {
                        zos.putNextEntry(new ZipEntry(imagePath));
                        is.transferTo(zos);
                        zos.closeEntry();
                        addedImages.add(imagePath);
                    }
                }
            }
        }
    }

    private String buildZipPath(Map<Long, WikiPage> allById, WikiPage page) {
        Deque<String> parts = new ArrayDeque<>();
        WikiPage cur = page;
        while (cur.getParentId() != null) {
            WikiPage parent = allById.get(cur.getParentId());
            if (parent == null) break;
            parts.addFirst(sanitizeFilename(parent.getTitle()));
            cur = parent;
        }
        if (parts.isEmpty()) return "";
        return String.join("/", parts) + "/";
    }

    private String sanitizeFilename(String s) {
        if (s == null) return "untitled";
        return s.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private void putZipEntry(ZipOutputStream zos, String name, byte[] bytes) throws Exception {
        zos.putNextEntry(new ZipEntry(name));
        zos.write(bytes);
        zos.closeEntry();
    }

    private String rewriteImageUrls(String content, Map<Long, String> fileNameMap) {
        if (content == null) return "";
        Matcher m = ATT_PATTERN.matcher(content);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            Long fid = Long.parseLong(m.group(1));
            String fname = fileNameMap.get(fid);
            m.appendReplacement(sb, fname != null ? "./images/" + fname : m.group(0));
        }
        m.appendTail(sb);
        return sb.toString();
    }
}
