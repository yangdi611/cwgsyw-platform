package com.cwgsyw.platform.module.approval;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.approval.dto.ApprovalSchemeVO;
import com.cwgsyw.platform.module.approval.dto.ApprovalSchemeVersionVO;
import com.cwgsyw.platform.module.approval.dto.CreateApprovalSchemeRequest;
import com.cwgsyw.platform.module.approval.dto.UpdateApprovalSchemeRequest;
import com.cwgsyw.platform.module.approval.dto.UpdateApprovalSchemeVersionRequest;
import com.cwgsyw.platform.module.approval.service.ApprovalSchemeService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class ApprovalSchemeController {
    private final ApprovalSchemeService schemeService;

    @GetMapping("/api/approval-schemes")
    @PreAuthorize("hasAuthority('approval:read')")
    public R<PageResult<ApprovalSchemeVO>> list(@RequestParam(required = false) String keyword,
                                                @RequestParam(required = false) String status,
                                                @RequestParam(defaultValue = "1") int page,
                                                @RequestParam(defaultValue = "20") int size,
                                                @AuthenticationPrincipal SecurityUser user) {
        return R.ok(schemeService.list(user.getTenantId(), keyword, status, page, size));
    }

    @PostMapping("/api/approval-schemes")
    @PreAuthorize("hasAuthority('approval:create')")
    public R<ApprovalSchemeVO> create(@Valid @RequestBody CreateApprovalSchemeRequest request,
                                      @AuthenticationPrincipal SecurityUser user) {
        return R.ok(schemeService.create(user.getTenantId(), user.getUserId(), request));
    }

    @GetMapping("/api/approval-schemes/{schemeId}")
    @PreAuthorize("hasAuthority('approval:read')")
    public R<ApprovalSchemeVO> get(@PathVariable Long schemeId, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(schemeService.get(user.getTenantId(), schemeId));
    }

    @PutMapping("/api/approval-schemes/{schemeId}")
    @PreAuthorize("hasAuthority('approval:update')")
    public R<ApprovalSchemeVO> update(@PathVariable Long schemeId,
                                      @Valid @RequestBody UpdateApprovalSchemeRequest request,
                                      @AuthenticationPrincipal SecurityUser user) {
        return R.ok(schemeService.update(user.getTenantId(), user.getUserId(), schemeId, request));
    }

    @GetMapping("/api/approval-schemes/{schemeId}/versions")
    @PreAuthorize("hasAuthority('approval:read')")
    public R<List<ApprovalSchemeVersionVO>> versions(@PathVariable Long schemeId,
                                                      @AuthenticationPrincipal SecurityUser user) {
        return R.ok(schemeService.versions(user.getTenantId(), schemeId));
    }

    @PostMapping("/api/approval-schemes/{schemeId}/versions")
    @PreAuthorize("hasAuthority('approval:update')")
    public R<ApprovalSchemeVersionVO> createVersion(@PathVariable Long schemeId,
                                                     @AuthenticationPrincipal SecurityUser user) {
        return R.ok(schemeService.createVersion(user.getTenantId(), user.getUserId(), schemeId));
    }

    @GetMapping("/api/approval-scheme-versions/{versionId}")
    @PreAuthorize("hasAuthority('approval:read')")
    public R<ApprovalSchemeVersionVO> version(@PathVariable Long versionId,
                                               @AuthenticationPrincipal SecurityUser user) {
        return R.ok(schemeService.version(user.getTenantId(), versionId));
    }

    @PutMapping("/api/approval-scheme-versions/{versionId}")
    @PreAuthorize("hasAuthority('approval:update')")
    public R<ApprovalSchemeVersionVO> updateVersion(@PathVariable Long versionId,
                                                     @Valid @RequestBody UpdateApprovalSchemeVersionRequest request,
                                                     @AuthenticationPrincipal SecurityUser user) {
        return R.ok(schemeService.updateVersion(user.getTenantId(), user.getUserId(), versionId, request));
    }

    @PostMapping("/api/approval-scheme-versions/{versionId}/publish")
    @PreAuthorize("hasAuthority('approval:publish')")
    public R<ApprovalSchemeVersionVO> publish(@PathVariable Long versionId,
                                              @AuthenticationPrincipal SecurityUser user) {
        return R.ok(schemeService.publish(user.getTenantId(), user.getUserId(), versionId));
    }
}
