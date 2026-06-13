package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cmdb/rel")
@RequiredArgsConstructor
public class CiInstanceRelController {

    private final CiInstanceRelService relService;

    @GetMapping("/{instanceId}")
    @PreAuthorize("hasAuthority('cmdb_instance:read')")
    public R<List<CiRelGroupVO>> getRelations(
            @PathVariable Long instanceId,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(relService.getRelations(user.getTenantId(), instanceId));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('cmdb_instance:create')")
    public R<CiInstanceRelVO> create(
            @Valid @RequestBody CreateRelRequest req,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(relService.createRelation(user.getTenantId(), user.getUserId(), req));
    }

    @DeleteMapping("/{relId}")
    @PreAuthorize("hasAuthority('cmdb_instance:delete')")
    public R<Void> delete(
            @PathVariable Long relId,
            @AuthenticationPrincipal SecurityUser user) {
        relService.deleteRelation(user.getTenantId(), relId, user.getUserId());
        return R.ok(null);
    }

    @GetMapping("/search")
    @PreAuthorize("hasAuthority('cmdb_instance:read')")
    public R<PageResult<InstanceSearchVO>> search(
            @RequestParam String modelId,
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(relService.searchInstances(user.getTenantId(), modelId, keyword, page, size));
    }
}
