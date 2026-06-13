package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.CiTopologyResult;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cmdb/topology")
@RequiredArgsConstructor
public class CiTopologyController {

    private final CiTopologyService topologyService;

    @GetMapping("/{instanceId}")
    @PreAuthorize("hasAuthority('cmdb_instance:read')")
    public R<CiTopologyResult> getTopology(
            @PathVariable Long instanceId,
            @RequestParam(defaultValue = "2") int depth,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(topologyService.getTopology(user.getTenantId(), instanceId, depth));
    }
}
