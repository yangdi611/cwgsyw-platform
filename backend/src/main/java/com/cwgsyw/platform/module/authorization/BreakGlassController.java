package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.authorization.dto.BreakGlassActivationRequest;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rbac/break-glass")
@RequiredArgsConstructor
public class BreakGlassController {
    private final BreakGlassService breakGlassService;

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public R<Void> activate(@Valid @RequestBody BreakGlassActivationRequest request,
                            @AuthenticationPrincipal SecurityUser user) {
        breakGlassService.activate(user, request.getReason());
        return R.ok();
    }

    @DeleteMapping
    @PreAuthorize("isAuthenticated()")
    public R<Void> deactivate(@AuthenticationPrincipal SecurityUser user) {
        breakGlassService.deactivate(user);
        return R.ok();
    }
}
