package com.cwgsyw.platform.module.task.plan;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.task.plan.dto.CiScopeRequest;
import com.cwgsyw.platform.module.task.plan.dto.CiScopeResolution;
import com.cwgsyw.platform.module.task.plan.service.CiScopeResolver;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cmdb/scopes")
@RequiredArgsConstructor
public class CiScopeController {
    private final CiScopeResolver resolver;

    @PostMapping({"/resolve", "/preview"})
    @PreAuthorize("hasAuthority('task_plan:read') and hasAuthority('cmdb_instance:read')")
    public R<CiScopeResolution> resolve(@Valid @RequestBody CiScopeRequest request,
                                        @AuthenticationPrincipal SecurityUser user) {
        return R.ok(resolver.resolve(user.getTenantId(), request));
    }
}
