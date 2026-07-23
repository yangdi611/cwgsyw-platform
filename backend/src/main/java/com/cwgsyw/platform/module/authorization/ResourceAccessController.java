package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.authorization.dto.ResourceAccessRequest;
import com.cwgsyw.platform.module.authorization.dto.ResourceAccessResponse;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api/access")
@RequiredArgsConstructor
public class ResourceAccessController {
    private final ResourceAccessService accessService;
    @GetMapping("/{resourceType}/{resourceId}")
    @PreAuthorize("isAuthenticated()")
    public R<ResourceAccessResponse> get(@PathVariable String resourceType, @PathVariable Long resourceId,
                                         @AuthenticationPrincipal SecurityUser user) {
        return R.ok(accessService.get(user, resourceType, resourceId));
    }

    @PutMapping("/{resourceType}/{resourceId}")
    @PreAuthorize("isAuthenticated()")
    public R<ResourceAccessResponse> replace(@PathVariable String resourceType, @PathVariable Long resourceId,
                                             @Valid @RequestBody ResourceAccessRequest request,
                                             @AuthenticationPrincipal SecurityUser user) {
        return R.ok(accessService.replace(user, resourceType, resourceId, request));
    }
}
