package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cmdb/instances")
@RequiredArgsConstructor
public class CiInstanceController {

    private final CiInstanceService instanceService;

    @GetMapping("/{modelId}")
    @PreAuthorize("hasAuthority('cmdb_instance:read')")
    public R<PageResult<CiInstanceVO>> list(
            @PathVariable String modelId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(instanceService.listInstances(user.getTenantId(), modelId, page, size));
    }

    @GetMapping("/{modelId}/{id}")
    @PreAuthorize("hasAuthority('cmdb_instance:read')")
    public R<CiInstanceVO> get(
            @PathVariable String modelId,
            @PathVariable Long id,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(instanceService.getInstance(user.getTenantId(), id));
    }

    @PostMapping("/{modelId}")
    @PreAuthorize("hasAuthority('cmdb_instance:create')")
    public R<CiInstanceVO> create(
            @PathVariable String modelId,
            @RequestBody SaveCiInstanceRequest req,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(instanceService.createInstance(user.getTenantId(), user.getUserId(), modelId, req));
    }

    @PutMapping("/{modelId}/{id}")
    @PreAuthorize("hasAuthority('cmdb_instance:update')")
    public R<CiInstanceVO> update(
            @PathVariable String modelId,
            @PathVariable Long id,
            @RequestBody SaveCiInstanceRequest req,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(instanceService.updateInstance(user.getTenantId(), id, user.getUserId(), req));
    }

    @DeleteMapping("/{modelId}/{id}")
    @PreAuthorize("hasAuthority('cmdb_instance:delete')")
    public R<Void> delete(
            @PathVariable String modelId,
            @PathVariable Long id,
            @AuthenticationPrincipal SecurityUser user) {
        instanceService.deleteInstance(user.getTenantId(), id, user.getUserId());
        return R.ok(null);
    }
}
