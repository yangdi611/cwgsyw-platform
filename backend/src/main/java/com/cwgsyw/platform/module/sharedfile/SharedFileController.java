package com.cwgsyw.platform.module.sharedfile;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.sharedfile.dto.SharedFileVO;
import com.cwgsyw.platform.module.sharedfile.dto.SharedFolderVO;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class SharedFileController {

    private final SharedFileService fileService;
    private final SharedFolderService folderService;

    @GetMapping("/folders")
    @PreAuthorize("hasAuthority('shared_file:read')")
    public R<List<SharedFolderVO>> getFolderTree(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(folderService.getFolderTree(user.getTenantId()));
    }

    @PostMapping("/folders")
    @PreAuthorize("hasAuthority('shared_file:manage')")
    public R<SharedFolderVO> createFolder(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal SecurityUser user) {
        String name = (String) body.get("name");
        Long parentId = body.get("parent_id") != null ? ((Number) body.get("parent_id")).longValue() : null;
        return R.ok(folderService.createFolder(user.getTenantId(), user.getUserId(), name, parentId));
    }

    @DeleteMapping("/folders/{id}")
    @PreAuthorize("hasAuthority('shared_file:manage')")
    public R<Void> deleteFolder(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        folderService.deleteFolder(user.getTenantId(), id, user.getUserId());
        return R.ok(null);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('shared_file:read')")
    public R<PageResult<SharedFileVO>> listFiles(
            @RequestParam(required = false) Long folderId,
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(fileService.listFiles(user.getTenantId(), folderId, keyword,
                user.getGroupId(), user.getGroupScope(), page, size));
    }

    @PostMapping("/upload")
    @PreAuthorize("hasAuthority('shared_file:upload')")
    public R<SharedFileVO> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder_id", required = false) Long folderId,
            @RequestParam(value = "visible_groups", required = false) List<Long> visibleGroups,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(fileService.uploadFile(user.getTenantId(), user.getUserId(), file, folderId, visibleGroups));
    }

    @GetMapping("/{id}/download-url")
    @PreAuthorize("hasAuthority('shared_file:read')")
    public R<String> getDownloadUrl(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(fileService.getPresignedUrl(user.getTenantId(), id, 300));
    }

    @GetMapping("/{id}/preview-url")
    @PreAuthorize("hasAuthority('shared_file:read')")
    public R<String> getPreviewUrl(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(fileService.getPresignedUrl(user.getTenantId(), id, 1800));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('shared_file:delete')")
    public R<Void> deleteFile(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        fileService.deleteFile(user.getTenantId(), id, user.getUserId());
        return R.ok(null);
    }
}
