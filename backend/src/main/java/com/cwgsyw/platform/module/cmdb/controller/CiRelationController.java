package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.relation.CiRelationVO;
import com.cwgsyw.platform.module.cmdb.dto.relation.CreateRelationRequest;
import com.cwgsyw.platform.module.cmdb.service.CiRelationService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cmdb/instances/{id}/relations")
@RequiredArgsConstructor
public class CiRelationController {

    private final CiRelationService ciRelationService;

    @PostMapping
    @PreAuthorize("hasPermission('cmdb_relation', 'create')")
    public R<CiRelationVO> create(@PathVariable Long id, @Valid @RequestBody CreateRelationRequest req, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciRelationService.create(id, req, cu.getTenantId(), cu.getUserId()));
    }

    @DeleteMapping("/{relationId}")
    @PreAuthorize("hasPermission('cmdb_relation', 'delete')")
    public R<Void> delete(@PathVariable Long id, @PathVariable Long relationId, @AuthenticationPrincipal SecurityUser cu) {
        ciRelationService.delete(relationId, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }

    @GetMapping
    @PreAuthorize("hasPermission('cmdb_relation', 'read')")
    public R<List<CiRelationVO>> list(@PathVariable Long id, @RequestParam(required = false) String kind, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciRelationService.list(id, kind, cu.getTenantId()));
    }
}
