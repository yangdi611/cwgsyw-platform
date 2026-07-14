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

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/access")
@RequiredArgsConstructor
public class ResourceAccessController {
    private final ResourceAccessService accessService;
    private final AuthorizationService authorizationService;

    @GetMapping("/mode/{module}")
    @PreAuthorize("isAuthenticated()")
    public R<Map<String, Object>> mode(@PathVariable String module,
                                        @AuthenticationPrincipal SecurityUser user) {
        if (!"wiki".equals(module) && !"shared_file".equals(module)) {
            throw new IllegalArgumentException("不支持的授权模块");
        }
        String state = authorizationService.rolloutState(user, module);
        return R.ok(Map.of("state", state, "enforced", "enforced".equals(state),
            "useUnifiedEditor", List.of("shadow", "enforced").contains(state)));
    }

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
