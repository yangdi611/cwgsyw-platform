package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.history.ChangeHistoryVO;
import com.cwgsyw.platform.module.cmdb.dto.instance.*;
import com.cwgsyw.platform.module.cmdb.service.CiInstanceService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cmdb/instances")
@RequiredArgsConstructor
public class CiInstanceController {

    private final CiInstanceService ciInstanceService;

    @GetMapping
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public R<PageResult<CiInstanceVO>> list(
            @RequestParam String model, @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciInstanceService.list(model, keyword, status, page, size, cu.getTenantId()));
    }

    @GetMapping("/search")
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public R<PageResult<CiInstanceSearchVO>> search(
            @RequestParam @NotBlank String keyword, @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciInstanceService.search(keyword, size, cu.getTenantId()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public R<CiInstanceDetailVO> getById(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciInstanceService.getDetail(id, cu.getTenantId()));
    }

    @PostMapping
    @PreAuthorize("hasPermission('cmdb_instance', 'create')")
    public R<CiInstanceDetailVO> create(@Valid @RequestBody CreateInstanceRequest req, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciInstanceService.create(req, cu.getTenantId(), cu.getUserId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('cmdb_instance', 'update')")
    public R<CiInstanceDetailVO> update(@PathVariable Long id, @RequestBody UpdateInstanceRequest req, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciInstanceService.update(id, req, cu.getTenantId(), cu.getUserId()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('cmdb_instance', 'delete')")
    public R<Void> delete(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        ciInstanceService.delete(id, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public R<PageResult<ChangeHistoryVO>> history(@PathVariable Long id,
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciInstanceService.getInstanceHistory(id, page, size, cu.getTenantId()));
    }

    @GetMapping("/changes")
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public R<PageResult<ChangeHistoryVO>> globalChanges(
            @RequestParam(required = false) String model, @RequestParam(required = false) Long operatorId,
            @RequestParam(required = false) String startDate, @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciInstanceService.getGlobalChanges(model, operatorId, startDate, endDate, page, size, cu.getTenantId()));
    }
}
