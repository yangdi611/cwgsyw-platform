package com.cwgsyw.platform.module.ai;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.ai.dto.AiProviderConfigVO;
import com.cwgsyw.platform.module.ai.dto.SaveAiProviderConfigRequest;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin/ai")
@RequiredArgsConstructor
public class AiConfigController {
    private final AiGatewayService aiGatewayService;

    @GetMapping("/providers")
    @PreAuthorize("hasAuthority('ai_config:read')")
    public R<List<AiProviderConfigVO>> listProviders(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(aiGatewayService.listProviders(user.getTenantId()));
    }

    @PutMapping("/providers/{provider}")
    @PreAuthorize("hasAuthority('ai_config:write')")
    public R<Void> saveProvider(@PathVariable String provider,
                                 @RequestBody SaveAiProviderConfigRequest req,
                                 @AuthenticationPrincipal SecurityUser user) {
        aiGatewayService.saveProviderConfig(user.getTenantId(), provider, req);
        return R.ok(null);
    }

    @PostMapping("/providers/{provider}/test")
    @PreAuthorize("hasAuthority('ai_config:write')")
    public R<String> testProvider(@PathVariable String provider,
                                   @AuthenticationPrincipal SecurityUser user) {
        String reply = aiGatewayService.testProvider(user.getTenantId(), provider);
        return R.ok(reply);
    }
}
