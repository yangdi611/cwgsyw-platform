package com.cwgsyw.platform.module.sharedfile;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.sharedfile.dto.SharedFileVO;
import com.cwgsyw.platform.module.sharedfile.dto.SharedFolderVO;
import com.cwgsyw.platform.module.sharedfile.dto.CreateFolderRequest;
import com.cwgsyw.platform.module.sharedfile.dto.UpdateFolderRequest;
import com.cwgsyw.platform.module.sharedfile.dto.UpdateSharedFileRequest;
import com.cwgsyw.platform.security.SecurityUser;
import com.cwgsyw.platform.module.authorization.AuthorizationService;
import org.springframework.security.access.AccessDeniedException;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class SharedFileController {

    private final SharedFileService fileService;
    private final SharedFolderService folderService;
    private final AuthorizationService authorizationService;

    @GetMapping("/folders")
    @PreAuthorize("hasAuthority('shared_file:read')")
    public R<List<SharedFolderVO>> getFolderTree(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(folderService.getFolderTree(user));
    }

    @PostMapping("/folders")
    @PreAuthorize("hasAuthority('shared_file:manage')")
    public R<SharedFolderVO> createFolder(
            @RequestBody CreateFolderRequest body,
            @AuthenticationPrincipal SecurityUser user) {
        Long ownerGroupId = body.getOwnerGroupId() != null ? body.getOwnerGroupId() : user.getGroupId();
        if (body.getParentId() != null) {
            requireResource(user, "shared_file:manage", "shared_folder", body.getParentId(), 3);
        } else {
            if (!authorizationService.canUseOwnerGroup(user, ownerGroupId)) {
                throw new AccessDeniedException("不能将目录归属到当前用户未加入的组");
            }
            if (!authorizationService.decideCreate(user, "shared_file:manage", ownerGroupId).isAllowed()) {
                throw new AccessDeniedException("当前作用域不允许创建根目录");
            }
        }
        return R.ok(folderService.createFolder(user.getTenantId(), user.getUserId(), body.getName(),
            body.getParentId(), ownerGroupId));
    }

    @DeleteMapping("/folders/{id}")
    @PreAuthorize("hasAuthority('shared_file:manage')")
    public R<Void> deleteFolder(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        authorizationService.requireParent(user, "shared_file:delete", "shared_folder", id, 3);
        folderService.deleteFolder(user.getTenantId(), id, user.getUserId());
        return R.ok(null);
    }

    @PatchMapping("/folders/{id}")
    @PreAuthorize("hasAuthority('shared_file:update')")
    public R<SharedFolderVO> updateFolder(@PathVariable Long id,
                                           @RequestBody @jakarta.validation.Valid UpdateFolderRequest body,
                                           @AuthenticationPrincipal SecurityUser user) {
        if (body.getName() == null && !body.isParentIdSpecified()) {
            throw new IllegalArgumentException("至少需要提供文件夹名称或目标目录");
        }
        if (body.getName() != null) {
            authorizationService.requireParent(user, "shared_file:update", "shared_folder", id, 2);
        }
        if (body.isParentIdSpecified()) {
            authorizationService.requireParent(user, "shared_file:manage", "shared_folder", id, 3);
            if (body.getParentId() == null) {
                Long ownerGroupId = folderService.getFolder(user.getTenantId(), id).getOwnerGroupId();
                if (!authorizationService.canUseOwnerGroup(user, ownerGroupId)
                        || !authorizationService.decideCreate(user, "shared_file:manage", ownerGroupId).isAllowed()) {
                    throw new AccessDeniedException("当前作用域不允许移动到根目录");
                }
            } else {
                authorizationService.require(user, "shared_file:manage", "shared_folder", body.getParentId(), 3);
            }
        }
        return R.ok(folderService.updateFolder(user.getTenantId(), user.getUserId(), id,
            body.getName(), body.getParentId(), body.isParentIdSpecified()));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('shared_file:read')")
    public R<PageResult<SharedFileVO>> listFiles(
            @RequestParam(required = false) Long folderId,
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser user) {
        if (folderId != null) requireResource(user, "shared_file:read", "shared_folder", folderId, 5);
        return R.ok(fileService.listFiles(user.getTenantId(), folderId, keyword, user, page, size));
    }

    @PostMapping("/upload")
    @PreAuthorize("hasAuthority('shared_file:upload')")
    public R<SharedFileVO> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder_id", required = false) Long folderId,
            @RequestParam(value = "visible_groups", required = false) List<Long> visibleGroups,
            @RequestParam(value = "owner_group_id", required = false) Long requestedOwnerGroupId,
            @AuthenticationPrincipal SecurityUser user) {
        Long ownerGroupId = requestedOwnerGroupId != null ? requestedOwnerGroupId : user.getGroupId();
        if (folderId != null) requireResource(user, "shared_file:upload", "shared_folder", folderId, 3);
        else if (!authorizationService.decideCreate(user, "shared_file:upload", ownerGroupId).isAllowed()) {
            throw new AccessDeniedException("当前作用域不允许上传根目录文件");
        }
        if (folderId == null && !authorizationService.canUseOwnerGroup(user, ownerGroupId)) {
            throw new AccessDeniedException("不能将文件归属到当前用户未加入的组");
        }
        return R.ok(fileService.uploadFile(user, file, folderId, visibleGroups, ownerGroupId));
    }

    @GetMapping("/{id}/download-url")
    @PreAuthorize("hasAuthority('shared_file:read')")
    public R<String> getDownloadUrl(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        requireResource(user, "shared_file:read", "shared_file", id, 4);
        fileService.getFile(user.getTenantId(), id);
        return R.ok("/api/files/" + id + "/download");
    }

    @GetMapping("/{id}/preview-url")
    @PreAuthorize("hasAuthority('shared_file:read')")
    public R<String> getPreviewUrl(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        requireResource(user, "shared_file:read", "shared_file", id, 4);
        fileService.getFile(user.getTenantId(), id);
        return R.ok("/api/files/" + id + "/preview");
    }

    @GetMapping("/{id}/download")
    @PreAuthorize("hasAuthority('shared_file:read')")
    public ResponseEntity<InputStreamResource> download(
            @PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        requireResource(user, "shared_file:read", "shared_file", id, 4);
        return fileContentResponse(fileService.getFileContent(user.getTenantId(), id), true);
    }

    @GetMapping("/{id}/preview")
    @PreAuthorize("hasAuthority('shared_file:read')")
    public ResponseEntity<InputStreamResource> preview(
            @PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        requireResource(user, "shared_file:read", "shared_file", id, 4);
        return fileContentResponse(fileService.getFileContent(user.getTenantId(), id), false);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('shared_file:delete')")
    public R<Void> deleteFile(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        authorizationService.requireParent(user, "shared_file:delete", "shared_file", id, 3);
        fileService.deleteFile(user, id);
        return R.ok(null);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('shared_file:update')")
    public R<SharedFileVO> updateFile(@PathVariable Long id, @RequestBody @jakarta.validation.Valid UpdateSharedFileRequest request,
                                      @AuthenticationPrincipal SecurityUser user) {
        if (request.getName() == null && !request.isParentIdSpecified()) {
            throw new IllegalArgumentException("至少需要提供文件名称或目标目录");
        }
        if (request.getName() != null) {
            authorizationService.requireParent(user, "shared_file:update", "shared_file", id, 2);
        }
        if (request.isParentIdSpecified()) {
            authorizationService.requireParent(user, "shared_file:manage", "shared_file", id, 3);
            if (request.getParentId() != null) {
                authorizationService.require(user, "shared_file:manage", "shared_folder", request.getParentId(), 3);
            }
        }
        return R.ok(fileService.updateFile(user, id, request.getName(), request.getParentId(),
            request.isParentIdSpecified()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('shared_file:read')")
    public R<SharedFileVO> getFile(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        requireResource(user, "shared_file:read", "shared_file", id, 4);
        return R.ok(fileService.getFile(user.getTenantId(), id));
    }

    private void requireResource(SecurityUser user, String permissionCode, String resourceType,
                                 Long resourceId, int requiredBits) {
        authorizationService.require(user, permissionCode, resourceType, resourceId, requiredBits);
    }

    private ResponseEntity<InputStreamResource> fileContentResponse(
            SharedFileService.FileContent content, boolean attachment) {
        ContentDisposition disposition = (attachment
                ? ContentDisposition.attachment()
                : ContentDisposition.inline())
                .filename(content.originalName(), StandardCharsets.UTF_8)
                .build();
        MediaType mediaType = MediaTypeFactory.getMediaType(content.originalName())
                .orElse(MediaType.APPLICATION_OCTET_STREAM);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .contentType(mediaType)
                .contentLength(content.sizeBytes())
                .body(new InputStreamResource(content.stream()));
    }
}
