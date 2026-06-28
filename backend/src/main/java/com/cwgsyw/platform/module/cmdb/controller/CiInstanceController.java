package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.changedoc.dto.LinkedChangeDocVO;
import com.cwgsyw.platform.module.cmdb.dto.changes.ChangeHistoryV2VO;
import com.cwgsyw.platform.module.cmdb.dto.instance.*;
import com.cwgsyw.platform.module.cmdb.service.CiChangeService;
import com.cwgsyw.platform.module.cmdb.service.Ci2DViewService;
import com.cwgsyw.platform.module.cmdb.service.CiInstanceCommandService;
import com.cwgsyw.platform.module.cmdb.service.CiInstanceQueryService;
import com.cwgsyw.platform.module.cmdb.service.CiRelatedResourceService;
import com.cwgsyw.platform.module.daily.dto.DailyReportBriefVO;
import com.cwgsyw.platform.module.device.dto.DeviceVO;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cmdb/instances")
@RequiredArgsConstructor
public class CiInstanceController {

    private final CiInstanceQueryService ciInstanceQueryService;
    private final CiInstanceCommandService ciInstanceCommandService;
    private final CiRelatedResourceService ciRelatedResourceService;
    private final CiChangeService ciChangeService;
    private final Ci2DViewService ci2DViewService;

    @GetMapping
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public R<PageResult<CiInstanceVO>> list(
            @RequestParam(required = false) String model, @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciInstanceQueryService.list(model, keyword, status, page, size, cu.getTenantId()));
    }

    @GetMapping("/search")
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public R<PageResult<CiInstanceSearchVO>> search(
            @RequestParam @NotBlank String keyword, @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciInstanceQueryService.search(keyword, size, cu.getTenantId()));
    }

    @GetMapping("/2d-view")
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public R<TwoDimensionViewVO> twoDView(
            @RequestParam @NotBlank String modelId,
            @RequestParam @NotBlank String groupBy,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ci2DViewService.get2DView(modelId, groupBy, cu.getTenantId()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public R<CiInstanceDetailVO> getById(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciInstanceQueryService.getDetail(id, cu.getTenantId()));
    }

    @PostMapping
    @PreAuthorize("hasPermission('cmdb_instance', 'create')")
    public R<CiInstanceDetailVO> create(@Valid @RequestBody CreateInstanceRequest req, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciInstanceCommandService.create(req, cu.getTenantId(), cu.getUserId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('cmdb_instance', 'update')")
    public R<CiInstanceDetailVO> update(@PathVariable Long id, @RequestBody UpdateInstanceRequest req, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciInstanceCommandService.update(id, req, cu.getTenantId(), cu.getUserId()));
    }

    @PostMapping("/batch-update")
    @PreAuthorize("hasPermission('cmdb_instance', 'update')")
    public R<BatchUpdateResultVO> batchUpdate(@Valid @RequestBody BatchUpdateInstanceRequest req,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciInstanceCommandService.batchUpdate(req, cu.getTenantId(), cu.getUserId()));
    }

    @PostMapping("/{id}/clone")
    @PreAuthorize("hasPermission('cmdb_instance', 'create')")
    public R<CiInstanceDetailVO> clone(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciInstanceCommandService.clone(id, cu.getTenantId(), cu.getUserId()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('cmdb_instance', 'delete')")
    public R<Void> delete(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        ciInstanceCommandService.delete(id, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("hasAuthority('cmdb_change:read')")
    public R<PageResult<ChangeHistoryV2VO>> history(
            @PathVariable Long id,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) Long operatorId,
            @RequestParam(required = false) String action,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciChangeService.getInstanceHistory(
                id, from, to, operatorId, action, page, size, cu.getTenantId()));
    }

    @GetMapping("/changes")
    @PreAuthorize("hasAuthority('cmdb_change:read')")
    public R<PageResult<ChangeHistoryV2VO>> globalChanges(
            @RequestParam(required = false) String model,
            @RequestParam(required = false) Long operatorId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String action,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciChangeService.getGlobalChanges(
                "ci_instance", null, model, startDate, endDate, operatorId, action,
                page, size, cu.getTenantId()));
    }

    @GetMapping("/{id}/devices")
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public R<List<DeviceVO>> getRelatedDevices(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciRelatedResourceService.getRelatedDevices(id, cu.getTenantId()));
    }

    @GetMapping("/{id}/change-docs")
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public R<List<LinkedChangeDocVO>> getRelatedChangeDocs(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciRelatedResourceService.getRelatedChangeDocs(id, cu.getTenantId()));
    }

    @GetMapping("/{id}/daily-reports")
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public R<List<DailyReportBriefVO>> getRelatedDailyReports(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciRelatedResourceService.getRelatedDailyReports(id, cu.getTenantId()));
    }

}
