package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.association.CiAssociationAttrDefVO;
import com.cwgsyw.platform.module.cmdb.dto.association.CreateAssociationAttrRequest;
import com.cwgsyw.platform.module.cmdb.dto.association.UpdateAssociationAttrRequest;
import com.cwgsyw.platform.module.cmdb.service.CiAssociationAttrDefService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cmdb/association-kinds/{kind}/attributes")
@RequiredArgsConstructor
public class CiAssociationAttrDefController {

    private final CiAssociationAttrDefService ciAssociationAttrDefService;

    @GetMapping
    @PreAuthorize("hasPermission('cmdb_model', 'read')")
    public R<List<CiAssociationAttrDefVO>> list(@PathVariable String kind, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciAssociationAttrDefService.list(kind, cu.getTenantId()));
    }

    @PostMapping
    @PreAuthorize("hasPermission('cmdb_model', 'update')")
    public R<CiAssociationAttrDefVO> create(@PathVariable String kind,
                                             @Valid @RequestBody CreateAssociationAttrRequest req,
                                             @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciAssociationAttrDefService.create(kind, req, cu.getTenantId(), cu.getUserId()));
    }

    @PutMapping("/{attrId}")
    @PreAuthorize("hasPermission('cmdb_model', 'update')")
    public R<CiAssociationAttrDefVO> update(@PathVariable String kind, @PathVariable Long attrId,
                                             @RequestBody UpdateAssociationAttrRequest req,
                                             @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciAssociationAttrDefService.update(kind, attrId, req, cu.getTenantId(), cu.getUserId()));
    }

    @DeleteMapping("/{attrId}")
    @PreAuthorize("hasPermission('cmdb_model', 'update')")
    public R<Void> delete(@PathVariable String kind, @PathVariable Long attrId,
                           @AuthenticationPrincipal SecurityUser cu) {
        ciAssociationAttrDefService.delete(kind, attrId, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }
}
