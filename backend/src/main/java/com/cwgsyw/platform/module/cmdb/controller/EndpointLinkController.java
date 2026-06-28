package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.endpoint.CreateEndpointLinkRequest;
import com.cwgsyw.platform.module.cmdb.dto.endpoint.EndpointLinkVO;
import com.cwgsyw.platform.module.cmdb.service.EndpointLinkService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 端点连接接口（spec §8.3，P3）。连接是 ci_endpoint_link 事实源；写操作走 cmdb_relation:*。
 */
@RestController
@RequestMapping("/api/cmdb/endpoint-links")
@RequiredArgsConstructor
public class EndpointLinkController {

    private final EndpointLinkService endpointLinkService;

    @PostMapping
    @PreAuthorize("hasPermission('cmdb_relation', 'create')")
    public R<EndpointLinkVO> create(@Valid @RequestBody CreateEndpointLinkRequest req,
                                    @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(endpointLinkService.create(req, cu.getTenantId(), cu.getUserId()));
    }

    @DeleteMapping("/{linkId}")
    @PreAuthorize("hasPermission('cmdb_relation', 'delete')")
    public R<Void> delete(@PathVariable Long linkId, @AuthenticationPrincipal SecurityUser cu) {
        endpointLinkService.delete(linkId, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }

    @GetMapping("/by-instance/{instanceId}")
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public R<List<EndpointLinkVO>> listByInstance(@PathVariable Long instanceId,
                                                  @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(endpointLinkService.listByInstance(instanceId, cu.getTenantId()));
    }
}
