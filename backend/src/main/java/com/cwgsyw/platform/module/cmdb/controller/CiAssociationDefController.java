package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.association.CiAssociationDefVO;
import com.cwgsyw.platform.module.cmdb.dto.association.CreateAssociationDefRequest;
import com.cwgsyw.platform.module.cmdb.dto.association.UpdateAssociationDefRequest;
import com.cwgsyw.platform.module.cmdb.service.CiAssociationDefService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cmdb/association-defs")
@RequiredArgsConstructor
public class CiAssociationDefController {

    private final CiAssociationDefService ciAssociationDefService;

    @GetMapping
    @PreAuthorize("hasPermission('cmdb_relation', 'read')")
    public R<List<CiAssociationDefVO>> list(
            @RequestParam(required = false) String srcModelId,
            @RequestParam(required = false) String dstModelId,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciAssociationDefService.list(cu.getTenantId(), srcModelId, dstModelId));
    }

    @PostMapping
    @PreAuthorize("hasPermission('cmdb_relation', 'create')")
    public R<CiAssociationDefVO> create(@Valid @RequestBody CreateAssociationDefRequest req,
                                        @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciAssociationDefService.create(req, cu.getTenantId(), cu.getUserId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('cmdb_relation', 'update')")
    public R<CiAssociationDefVO> update(@PathVariable Long id,
                                        @Valid @RequestBody UpdateAssociationDefRequest req,
                                        @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciAssociationDefService.update(id, req, cu.getTenantId(), cu.getUserId()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('cmdb_relation', 'delete')")
    public R<Void> delete(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        ciAssociationDefService.delete(id, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }
}
