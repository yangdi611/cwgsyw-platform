package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.relation.CiRelationVO;
import com.cwgsyw.platform.module.cmdb.dto.relation.CreateRelationRequest;
import com.cwgsyw.platform.module.cmdb.dto.relation.CreateReverseRelationRequest;
import com.cwgsyw.platform.module.cmdb.dto.relation.UpdateRelationRequest;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationDef;
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
    public R<CiRelationVO> create(@PathVariable Long id, @Valid @RequestBody CreateRelationRequest req,
                                   @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciRelationService.create(id, req, cu.getTenantId(), cu.getUserId()));
    }

    /**
     * 当前实例可作为 src 建立的关联定义列表（AC3-8 前端选择 def 而非裸 kind 的数据源）。
     */
    @GetMapping("/applicable-defs")
    @PreAuthorize("hasPermission('cmdb_relation', 'read')")
    public R<List<CiAssociationDef>> applicableDefs(@PathVariable Long id,
                                                     @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciRelationService.listApplicableDefs(id, cu.getTenantId()));
    }

    /**
     * 当前实例可作为 dst（被关联方）的关联定义列表（§5.5 P2 反向建边）。
     * 例：host 详情页"所在机柜"入口的 def 数据源（rack_contains_host 等）。
     */
    @GetMapping("/reverse-defs")
    @PreAuthorize("hasPermission('cmdb_relation', 'read')")
    public R<List<CiAssociationDef>> reverseDefs(@PathVariable Long id,
                                                  @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciRelationService.listReverseDefs(id, cu.getTenantId()));
    }

    /**
     * 反向建边（§5.5 P2）：当前实例作为 dst，由 body.srcInstanceId 指向它。
     */
    @PostMapping("/reverse")
    @PreAuthorize("hasPermission('cmdb_relation', 'create')")
    public R<CiRelationVO> createReverse(@PathVariable Long id, @Valid @RequestBody CreateReverseRelationRequest req,
                                          @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciRelationService.createReverse(id, req.getSrcInstanceId(), req.getDefId(),
                req.getMetadata(), cu.getTenantId(), cu.getUserId()));
    }

    @PutMapping("/{relationId}")
    @PreAuthorize("hasPermission('cmdb_relation', 'update')")
    public R<CiRelationVO> update(@PathVariable Long id, @PathVariable Long relationId,
                                   @RequestBody UpdateRelationRequest req,
                                   @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciRelationService.update(id, relationId, req, cu.getTenantId(), cu.getUserId()));
    }

    @DeleteMapping("/{relationId}")
    @PreAuthorize("hasPermission('cmdb_relation', 'delete')")
    public R<Void> delete(@PathVariable Long id, @PathVariable Long relationId,
                           @AuthenticationPrincipal SecurityUser cu) {
        ciRelationService.delete(relationId, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }

    @GetMapping
    @PreAuthorize("hasPermission('cmdb_relation', 'read')")
    public R<List<CiRelationVO>> list(@PathVariable Long id, @RequestParam(required = false) String kind,
                                       @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciRelationService.list(id, kind, cu.getTenantId()));
    }
}
