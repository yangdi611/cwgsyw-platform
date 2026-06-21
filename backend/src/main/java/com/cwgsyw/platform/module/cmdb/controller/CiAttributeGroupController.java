package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.attributegroup.AttributeGroupVO;
import com.cwgsyw.platform.module.cmdb.dto.attributegroup.CreateAttributeGroupRequest;
import com.cwgsyw.platform.module.cmdb.dto.attributegroup.UpdateAttributeGroupRequest;
import com.cwgsyw.platform.module.cmdb.service.CiAttributeGroupService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cmdb/models/{modelCode}/attribute-groups")
@RequiredArgsConstructor
public class CiAttributeGroupController {

    private final CiAttributeGroupService ciAttributeGroupService;

    @GetMapping
    @PreAuthorize("hasPermission('cmdb_model', 'read')")
    public R<List<AttributeGroupVO>> list(@PathVariable String modelCode,
                                           @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciAttributeGroupService.list(modelCode, cu.getTenantId()));
    }

    @PostMapping
    @PreAuthorize("hasPermission('cmdb_model', 'manage')")
    public R<AttributeGroupVO> create(@PathVariable String modelCode,
                                       @Valid @RequestBody CreateAttributeGroupRequest req,
                                       @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciAttributeGroupService.create(modelCode, req, cu.getTenantId(), cu.getUserId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('cmdb_model', 'manage')")
    public R<AttributeGroupVO> update(@PathVariable String modelCode, @PathVariable Long id,
                                       @Valid @RequestBody UpdateAttributeGroupRequest req,
                                       @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciAttributeGroupService.update(modelCode, id, req, cu.getTenantId(), cu.getUserId()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('cmdb_model', 'manage')")
    public R<Void> delete(@PathVariable String modelCode, @PathVariable Long id,
                           @AuthenticationPrincipal SecurityUser cu) {
        ciAttributeGroupService.delete(modelCode, id, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }
}
