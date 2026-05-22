package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.changedoc.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/change-docs")
@RequiredArgsConstructor
public class ChangeDocController {
    private final ChangeDocService changeDocService;

    @GetMapping
    @PreAuthorize("hasAuthority('change_doc:read')")
    public R<List<ChangeDocVO>> list(
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.list(user.getTenantId(), status));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('change_doc:read')")
    public R<ChangeDocVO> get(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.get(user.getTenantId(), id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('change_doc:create')")
    public R<ChangeDocVO> create(@RequestBody CreateChangeDocRequest req,
                                  @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.create(user.getTenantId(), user.getUserId(), req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('change_doc:update')")
    public R<ChangeDocVO> update(@PathVariable Long id,
                                  @RequestBody UpdateChangeDocRequest req,
                                  @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.update(user.getTenantId(), id, user.getUserId(), req));
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasAuthority('change_doc:update')")
    public R<ChangeDocVO> submit(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.submit(user.getTenantId(), id, user.getUserId()));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('change_doc:approve')")
    public R<ChangeDocVO> approve(@PathVariable Long id,
                                   @RequestBody ApproveRequest req,
                                   @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.approve(user.getTenantId(), id, user.getUserId(),
                req.getComment(), Boolean.TRUE.equals(req.getApproved())));
    }

    @PostMapping("/{id}/ai-generate")
    @PreAuthorize("hasAuthority('change_doc:update')")
    public R<String> aiGenerate(@PathVariable Long id,
                                 @RequestBody AiGenerateRequest req,
                                 @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.generateAiContent(user.getTenantId(), id, user.getUserId(), req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('change_doc:delete')")
    public R<Void> delete(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        changeDocService.delete(user.getTenantId(), id, user.getUserId());
        return R.ok(null);
    }
}
