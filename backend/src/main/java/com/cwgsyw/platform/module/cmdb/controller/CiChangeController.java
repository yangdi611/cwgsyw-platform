package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.changes.ChangeHistoryV2VO;
import com.cwgsyw.platform.module.cmdb.dto.changes.ChangeStatsVO;
import com.cwgsyw.platform.module.cmdb.service.CiChangeService;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cmdb")
@RequiredArgsConstructor
public class CiChangeController {

    private final CiChangeService ciChangeService;

    @GetMapping("/instances/{instanceId}/history")
    @PreAuthorize("hasAuthority('cmdb_change:read')")
    public R<PageResult<ChangeHistoryV2VO>> instanceHistory(
            @PathVariable Long instanceId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) Long operatorId,
            @RequestParam(required = false) String action,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciChangeService.getInstanceHistory(
                instanceId, from, to, operatorId, action, page, size, cu.getTenantId()));
    }

    @GetMapping("/changes")
    @PreAuthorize("hasAuthority('cmdb_change:read')")
    public R<PageResult<ChangeHistoryV2VO>> globalChanges(
            @RequestParam(defaultValue = "ci_instance") String entityType,
            @RequestParam(required = false) Long entityId,
            @RequestParam(required = false) String modelId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) Long operatorId,
            @RequestParam(required = false) String action,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciChangeService.getGlobalChanges(
                entityType, entityId, modelId, from, to, operatorId, action,
                page, size, cu.getTenantId()));
    }

    @GetMapping("/changes/stats")
    @PreAuthorize("hasAuthority('cmdb_change:read')")
    public R<ChangeStatsVO> stats(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String modelId,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciChangeService.getStats(modelId, from, to, cu.getTenantId()));
    }
}
