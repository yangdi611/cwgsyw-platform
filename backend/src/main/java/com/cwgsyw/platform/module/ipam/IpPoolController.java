package com.cwgsyw.platform.module.ipam;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.ipam.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ip-pools")
@RequiredArgsConstructor
public class IpPoolController {
    private final IpPoolService ipPoolService;

    @GetMapping
    @PreAuthorize("hasAuthority('ip_pool:read')")
    public R<PageResult<IpPoolVO>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ipPoolService.list(keyword, status, page, size, cu.getTenantId()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ip_pool:read')")
    public R<IpPoolDetailVO> getById(@PathVariable Long id,
                                     @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ipPoolService.getById(id, cu.getTenantId()));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ip_pool:create')")
    public R<IpPoolVO> create(@Valid @RequestBody CreateIpPoolRequest req,
                              @AuthenticationPrincipal SecurityUser cu) {
        var pool = ipPoolService.create(req, cu.getTenantId(), cu.getUserId());
        return R.ok(ipPoolService.utilization(pool.getId(), cu.getTenantId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ip_pool:update')")
    public R<Void> update(@PathVariable Long id,
                          @RequestBody UpdateIpPoolRequest req,
                          @AuthenticationPrincipal SecurityUser cu) {
        ipPoolService.update(id, req, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ip_pool:delete')")
    public R<Void> delete(@PathVariable Long id,
                          @AuthenticationPrincipal SecurityUser cu) {
        ipPoolService.delete(id, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }

    @PostMapping("/{id}/allocate")
    @PreAuthorize("hasAuthority('ip_pool:update')")
    public R<IpAllocationVO> allocate(@PathVariable Long id,
                                      @RequestBody AllocateIpRequest req,
                                      @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ipPoolService.allocate(id, req, cu.getTenantId(), cu.getUserId()));
    }

    @PostMapping("/{id}/release")
    @PreAuthorize("hasAuthority('ip_pool:update')")
    public R<Void> release(@PathVariable Long id,
                           @Valid @RequestBody ReleaseIpRequest req,
                           @AuthenticationPrincipal SecurityUser cu) {
        ipPoolService.release(id, req, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }

    @GetMapping("/{id}/utilization")
    @PreAuthorize("hasAuthority('ip_pool:read')")
    public R<IpPoolVO> utilization(@PathVariable Long id,
                                   @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ipPoolService.utilization(id, cu.getTenantId()));
    }

    @GetMapping("/instances/{ciInstanceId}")
    @PreAuthorize("hasAuthority('ip_pool:read')")
    public R<List<IpAllocationVO>> getByCiInstance(@PathVariable Long ciInstanceId,
                                                   @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ipPoolService.getByCiInstanceId(ciInstanceId, cu.getTenantId()));
    }
}
