package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.attribute.CiAttributeVO;
import com.cwgsyw.platform.module.cmdb.dto.attribute.CreateAttributeRequest;
import com.cwgsyw.platform.module.cmdb.dto.attribute.UpdateAttributeRequest;
import com.cwgsyw.platform.module.cmdb.service.CiAttributeService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cmdb/models/{modelId}/attributes")
@RequiredArgsConstructor
public class CiAttributeController {

    private final CiAttributeService ciAttributeService;

    @GetMapping
    @PreAuthorize("hasPermission('cmdb_model', 'read')")
    public R<List<CiAttributeVO>> list(@PathVariable String modelId, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciAttributeService.list(modelId, cu.getTenantId()));
    }

    @PostMapping
    @PreAuthorize("hasPermission('cmdb_model', 'write')")
    public R<CiAttributeVO> create(@PathVariable String modelId, @Valid @RequestBody CreateAttributeRequest req, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciAttributeService.create(modelId, req, cu.getTenantId(), cu.getUserId()));
    }

    @PutMapping("/{attrId}")
    @PreAuthorize("hasPermission('cmdb_model', 'write')")
    public R<CiAttributeVO> update(@PathVariable String modelId, @PathVariable Long attrId,
            @RequestBody UpdateAttributeRequest req, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciAttributeService.update(modelId, attrId, req, cu.getTenantId(), cu.getUserId()));
    }

    @DeleteMapping("/{attrId}")
    @PreAuthorize("hasPermission('cmdb_model', 'write')")
    public R<Void> delete(@PathVariable String modelId, @PathVariable Long attrId, @AuthenticationPrincipal SecurityUser cu) {
        ciAttributeService.delete(modelId, attrId, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }
}
