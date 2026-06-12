package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.topology.TopologyResultVO;
import com.cwgsyw.platform.module.cmdb.service.CiTopologyService;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cmdb/topology")
@RequiredArgsConstructor
public class CiTopologyController {

    private final CiTopologyService ciTopologyService;

    @GetMapping("/{instanceId}")
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public R<TopologyResultVO> getTopology(
            @PathVariable Long instanceId,
            @RequestParam(defaultValue = "5") int depth,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciTopologyService.getTopology(instanceId, depth, cu.getTenantId()));
    }
}
