package com.cwgsyw.platform.module.wiki;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFile;
import com.cwgsyw.platform.module.wiki.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/wiki")
@RequiredArgsConstructor
public class WikiController {

    private final WikiSpaceService spaceService;
    private final WikiPageService pageService;
    private final WikiAclService aclService;
    private final WikiBacklinkService backlinkService;
    private final WikiAttachmentService attachmentService;
    private final WikiExportService exportService;

    private void checkAcl(SecurityUser u, Long pageId, String perm) {
        if (!aclService.hasPermission(u.getTenantId(), pageId, u.getUserId(), u.getGroupId(),
                u.getGroupScope(), perm))
            throw new AccessDeniedException("无权限");
    }

    // ===== Spaces =====

    @GetMapping("/spaces")
    @PreAuthorize("hasAuthority('wiki:read')")
    public R<List<WikiSpaceVO>> listSpaces(@AuthenticationPrincipal SecurityUser u) {
        return R.ok(spaceService.listSpaces(u.getTenantId()));
    }

    @PostMapping("/spaces")
    @PreAuthorize("hasAuthority('wiki:create')")
    public R<WikiSpaceVO> createSpace(@RequestBody CreateSpaceRequest req,
                                      @AuthenticationPrincipal SecurityUser u) {
        return R.ok(spaceService.createSpace(u.getTenantId(), u.getUserId(), req.getName(), req.getDescription()));
    }

    @PutMapping("/spaces/{id}")
    @PreAuthorize("hasAuthority('wiki:update')")
    public R<WikiSpaceVO> updateSpace(@PathVariable Long id, @RequestBody CreateSpaceRequest req,
                                      @AuthenticationPrincipal SecurityUser u) {
        return R.ok(spaceService.updateSpace(u.getTenantId(), id, u.getUserId(), req.getName(), req.getDescription()));
    }

    @DeleteMapping("/spaces/{id}")
    @PreAuthorize("hasAuthority('wiki:delete')")
    public R<Void> deleteSpace(@PathVariable Long id, @AuthenticationPrincipal SecurityUser u) {
        spaceService.deleteSpace(u.getTenantId(), id, u.getUserId());
        return R.ok(null);
    }

    @GetMapping("/spaces/{id}/tree")
    @PreAuthorize("hasAuthority('wiki:read')")
    public R<List<WikiPageTreeVO>> getTree(@PathVariable Long id, @AuthenticationPrincipal SecurityUser u) {
        return R.ok(pageService.getTree(u.getTenantId(), id));
    }

    @GetMapping("/spaces/{id}/graph")
    @PreAuthorize("hasAuthority('wiki:read')")
    public R<GraphVO> getGraph(@PathVariable Long id, @AuthenticationPrincipal SecurityUser u) {
        return R.ok(pageService.getGraph(u.getTenantId(), id));
    }

    @GetMapping("/spaces/{id}/export")
    @PreAuthorize("hasAuthority('wiki:read')")
    public void exportSpace(@PathVariable Long id, HttpServletResponse response,
                            @AuthenticationPrincipal SecurityUser u) throws Exception {
        exportService.exportSpace(id, u.getTenantId(), response);
    }

    // ===== Pages =====

    @GetMapping("/pages/{id}")
    @PreAuthorize("hasAuthority('wiki:read')")
    public R<WikiPageVO> getPage(@PathVariable Long id, @AuthenticationPrincipal SecurityUser u) {
        checkAcl(u, id, "read");
        return R.ok(pageService.getPage(u.getTenantId(), id, u.getUserId()));
    }

    @PostMapping("/pages")
    @PreAuthorize("hasAuthority('wiki:create')")
    public R<WikiPageVO> createPage(@RequestBody CreatePageRequest req,
                                    @AuthenticationPrincipal SecurityUser u) {
        if (req.getParentId() != null) checkAcl(u, req.getParentId(), "write");
        return R.ok(pageService.createPage(u.getTenantId(), u.getUserId(), req));
    }

    @PutMapping("/pages/{id}")
    @PreAuthorize("hasAuthority('wiki:update')")
    public R<WikiPageVO> savePage(@PathVariable Long id, @RequestBody SavePageRequest req,
                                  @AuthenticationPrincipal SecurityUser u) {
        checkAcl(u, id, "write");
        return R.ok(pageService.savePage(u.getTenantId(), u.getUserId(), id, req));
    }

    @DeleteMapping("/pages/{id}")
    @PreAuthorize("hasAuthority('wiki:delete')")
    public R<Void> deletePage(@PathVariable Long id, @AuthenticationPrincipal SecurityUser u) {
        checkAcl(u, id, "delete");
        pageService.deletePage(u.getTenantId(), id, u.getUserId());
        return R.ok(null);
    }

    @PostMapping("/pages/{id}/move")
    @PreAuthorize("hasAuthority('wiki:update')")
    public R<Void> movePage(@PathVariable Long id, @RequestBody MovePageRequest req,
                            @AuthenticationPrincipal SecurityUser u) {
        checkAcl(u, id, "write");
        pageService.movePage(u.getTenantId(), id, req.getParentId(), req.getSortOrder(), u.getUserId());
        return R.ok(null);
    }

    @PostMapping("/pages/{id}/submit")
    @PreAuthorize("hasAuthority('wiki:update')")
    public R<Void> submitForReview(@PathVariable Long id, @AuthenticationPrincipal SecurityUser u) {
        pageService.submitForReview(u.getTenantId(), id, u.getUserId());
        return R.ok(null);
    }

    @PostMapping("/pages/{id}/publish")
    @PreAuthorize("hasAuthority('wiki:publish')")
    public R<Void> publish(@PathVariable Long id, @AuthenticationPrincipal SecurityUser u) {
        pageService.publishDirect(u.getTenantId(), id, u.getUserId());
        return R.ok(null);
    }

    @GetMapping("/pages/{id}/versions")
    @PreAuthorize("hasAuthority('wiki:read')")
    public R<List<WikiVersionVO>> listVersions(@PathVariable Long id, @AuthenticationPrincipal SecurityUser u) {
        return R.ok(pageService.listVersions(id));
    }

    @PostMapping("/pages/{id}/revert/{version}")
    @PreAuthorize("hasAuthority('wiki:update')")
    public R<WikiPageVO> revert(@PathVariable Long id, @PathVariable int version,
                                @AuthenticationPrincipal SecurityUser u) {
        checkAcl(u, id, "write");
        return R.ok(pageService.revert(u.getTenantId(), id, version, u.getUserId()));
    }

    @GetMapping("/pages/{id}/export")
    @PreAuthorize("hasAuthority('wiki:read')")
    public void exportPage(@PathVariable Long id, HttpServletResponse response,
                           @AuthenticationPrincipal SecurityUser u) throws Exception {
        checkAcl(u, id, "read");
        exportService.exportPage(id, u.getTenantId(), response);
    }

    @GetMapping("/pages/{id}/backlinks")
    @PreAuthorize("hasAuthority('wiki:read')")
    public R<List<WikiBacklinkVO>> getBacklinks(@PathVariable Long id, @AuthenticationPrincipal SecurityUser u) {
        return R.ok(backlinkService.getBacklinks(u.getTenantId(), id));
    }

    @GetMapping("/pages/{id}/acl")
    @PreAuthorize("hasAuthority('wiki:manage_acl')")
    public R<WikiAclDTO> getAcl(@PathVariable Long id, @AuthenticationPrincipal SecurityUser u) {
        return R.ok(aclService.getAcl(u.getTenantId(), id));
    }

    @PutMapping("/pages/{id}/acl")
    @PreAuthorize("hasAuthority('wiki:manage_acl')")
    public R<Void> setAcl(@PathVariable Long id, @RequestBody WikiAclDTO body,
                          @AuthenticationPrincipal SecurityUser u) {
        aclService.setAcl(u.getTenantId(), id, u.getUserId(), body);
        return R.ok(null);
    }

    // ===== Attachments =====

    @PostMapping("/attachments")
    @PreAuthorize("hasAuthority('wiki:update')")
    public R<Map<String, Object>> uploadAttachment(
            @RequestParam("file") MultipartFile file,
            @RequestParam("page_id") Long pageId,
            @AuthenticationPrincipal SecurityUser u) {
        checkAcl(u, pageId, "write");
        SharedFile sf = attachmentService.uploadAttachment(u.getTenantId(), u.getUserId(), pageId, file);
        Map<String, Object> result = new HashMap<>();
        result.put("file_id", sf.getId());
        result.put("url", "/api/wiki/attachments/" + sf.getId());
        result.put("original_name", sf.getOriginalName());
        return R.ok(result);
    }

    @GetMapping("/attachments/{fileId}")
    @PreAuthorize("hasAuthority('wiki:read')")
    public void getAttachment(@PathVariable Long fileId, HttpServletResponse response,
                              @AuthenticationPrincipal SecurityUser u) throws Exception {
        attachmentService.streamTo(u.getTenantId(), fileId, response);
    }

    // ===== Search =====

    @GetMapping("/search")
    @PreAuthorize("hasAuthority('wiki:read')")
    public R<PageResult<WikiSearchResultVO>> search(
            @RequestParam String keyword,
            @RequestParam(required = false) Long spaceId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser u) {
        return R.ok(pageService.search(u.getTenantId(), keyword, spaceId, page, size));
    }
}
