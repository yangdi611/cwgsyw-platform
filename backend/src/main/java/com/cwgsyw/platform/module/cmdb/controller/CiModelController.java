package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.model.CiModelVO;
import com.cwgsyw.platform.module.cmdb.dto.model.CreateModelRequest;
import com.cwgsyw.platform.module.cmdb.dto.model.UpdateModelRequest;
import com.cwgsyw.platform.module.cmdb.service.CiModelService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cmdb/models")
@RequiredArgsConstructor
public class CiModelController {

    private final CiModelService ciModelService;

    @GetMapping
    @PreAuthorize("hasPermission('cmdb_model', 'read')")
    public R<PageResult<CiModelVO>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String group,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciModelService.list(keyword, group, page, size, cu.getTenantId()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasPermission('cmdb_model', 'read')")
    public R<CiModelVO> getById(@PathVariable String id, @AuthenticationPrincipal SecurityUser cu) {
        try {
            return R.ok(ciModelService.getById(Long.parseLong(id), cu.getTenantId()));
        } catch (NumberFormatException e) {
            return R.ok(ciModelService.getByCode(id, cu.getTenantId()));
        }
    }

    @PostMapping
    @PreAuthorize("hasPermission('cmdb_model', 'create')")
    public R<CiModelVO> create(@Valid @RequestBody CreateModelRequest req, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciModelService.create(req, cu.getTenantId(), cu.getUserId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('cmdb_model', 'update')")
    public R<CiModelVO> update(@PathVariable Long id, @RequestBody UpdateModelRequest req, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciModelService.update(id, req, cu.getTenantId(), cu.getUserId()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('cmdb_model', 'delete')")
    public R<Void> delete(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        ciModelService.delete(id, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }
}
