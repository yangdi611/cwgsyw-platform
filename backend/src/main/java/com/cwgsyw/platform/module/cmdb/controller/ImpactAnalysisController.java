package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.impact.ImpactAnalysisRequest;
import com.cwgsyw.platform.module.cmdb.dto.impact.ImpactAnalysisResultVO;
import com.cwgsyw.platform.module.cmdb.service.ImpactAnalysisService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cmdb/instances/{id}/impact")
@RequiredArgsConstructor
public class ImpactAnalysisController {

    private final ImpactAnalysisService impactAnalysisService;

    @PostMapping
    @PreAuthorize("hasPermission('cmdb_instance', 'read') and hasPermission('cmdb_instance', 'impact')")
    public R<ImpactAnalysisResultVO> analyze(@PathVariable Long id,
                                              @RequestBody(required = false) @Valid ImpactAnalysisRequest req,
                                              @AuthenticationPrincipal SecurityUser cu) {
        if (req == null) req = new ImpactAnalysisRequest();
        return R.ok(impactAnalysisService.analyze(id, req, cu.getTenantId()));
    }
}
