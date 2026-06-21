package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.modelgroup.CreateModelGroupRequest;
import com.cwgsyw.platform.module.cmdb.dto.modelgroup.ModelGroupVO;
import com.cwgsyw.platform.module.cmdb.dto.modelgroup.UpdateModelGroupRequest;
import com.cwgsyw.platform.module.cmdb.service.CiModelGroupService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cmdb/model-groups")
@RequiredArgsConstructor
public class CiModelGroupController {

    private final CiModelGroupService ciModelGroupService;

    @GetMapping
    @PreAuthorize("hasPermission('cmdb_model', 'read')")
    public R<List<ModelGroupVO>> list(@AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciModelGroupService.list(cu.getTenantId()));
    }

    @PostMapping
    @PreAuthorize("hasPermission('cmdb_model', 'manage')")
    public R<ModelGroupVO> create(@Valid @RequestBody CreateModelGroupRequest req,
                                   @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciModelGroupService.create(req, cu.getTenantId(), cu.getUserId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('cmdb_model', 'manage')")
    public R<ModelGroupVO> update(@PathVariable Long id,
                                   @Valid @RequestBody UpdateModelGroupRequest req,
                                   @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciModelGroupService.update(id, req, cu.getTenantId(), cu.getUserId()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('cmdb_model', 'manage')")
    public R<Void> delete(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        ciModelGroupService.delete(id, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }
}
