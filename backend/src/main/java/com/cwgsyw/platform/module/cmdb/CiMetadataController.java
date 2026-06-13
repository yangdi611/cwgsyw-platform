package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.*;
import com.cwgsyw.platform.module.cmdb.entity.*;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cmdb/meta")
@RequiredArgsConstructor
public class CiMetadataController {

    private final CiMetadataService metadataService;

    // ── Models ────────────────────────────────────────────────────────────────

    @GetMapping("/models")
    @PreAuthorize("hasAuthority('cmdb_model:read')")
    public R<List<CiModelVO>> listModels(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(metadataService.listModels(user.getTenantId()));
    }

    @GetMapping("/models/{modelId}")
    @PreAuthorize("hasAuthority('cmdb_model:read')")
    public R<CiModelVO> getModel(@PathVariable String modelId,
                                  @AuthenticationPrincipal SecurityUser user) {
        return R.ok(metadataService.getModel(user.getTenantId(), modelId));
    }

    @PostMapping("/models")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<CiModelVO> createModel(@Valid @RequestBody SaveCiModelRequest req,
                                     @AuthenticationPrincipal SecurityUser user) {
        return R.ok(metadataService.createModel(user.getTenantId(), user.getUserId(), req));
    }

    @PutMapping("/models/{modelId}")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<Void> updateModel(@PathVariable String modelId,
                                @Valid @RequestBody SaveCiModelRequest req,
                                @AuthenticationPrincipal SecurityUser user) {
        metadataService.updateModel(user.getTenantId(), modelId, user.getUserId(), req);
        return R.ok(null);
    }

    @DeleteMapping("/models/{modelId}")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<Void> deleteModel(@PathVariable String modelId,
                                @AuthenticationPrincipal SecurityUser user) {
        metadataService.deleteModel(user.getTenantId(), modelId, user.getUserId());
        return R.ok(null);
    }

    // ── Attributes ────────────────────────────────────────────────────────────

    @PostMapping("/models/{modelId}/attributes")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<CiAttributeVO> createAttribute(@PathVariable String modelId,
                                              @Valid @RequestBody SaveCiAttributeRequest req,
                                              @AuthenticationPrincipal SecurityUser user) {
        return R.ok(metadataService.createAttribute(user.getTenantId(), modelId, user.getUserId(), req));
    }

    @PutMapping("/attributes/{attrId}")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<Void> updateAttribute(@PathVariable Long attrId,
                                    @RequestBody SaveCiAttributeRequest req,
                                    @AuthenticationPrincipal SecurityUser user) {
        metadataService.updateAttribute(user.getTenantId(), attrId, user.getUserId(), req);
        return R.ok(null);
    }

    @DeleteMapping("/attributes/{attrId}")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<Void> deleteAttribute(@PathVariable Long attrId,
                                    @AuthenticationPrincipal SecurityUser user) {
        metadataService.deleteAttribute(user.getTenantId(), attrId, user.getUserId());
        return R.ok(null);
    }

    // ── Association Kinds ─────────────────────────────────────────────────────

    @GetMapping("/association-kinds")
    @PreAuthorize("hasAuthority('cmdb_model:read')")
    public R<List<CiAssociationKind>> listKinds(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(metadataService.listKinds(user.getTenantId()));
    }

    @PostMapping("/association-kinds")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<CiAssociationKind> createKind(@Valid @RequestBody SaveAssociationKindRequest req,
                                            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(metadataService.createKind(user.getTenantId(), user.getUserId(), req));
    }

    // ── Association Defs ──────────────────────────────────────────────────────

    @GetMapping("/association-defs")
    @PreAuthorize("hasAuthority('cmdb_model:read')")
    public R<List<CiAssociationDef>> listDefs(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(metadataService.listDefs(user.getTenantId()));
    }

    @PostMapping("/association-defs")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<CiAssociationDef> createDef(@Valid @RequestBody SaveAssociationDefRequest req,
                                          @AuthenticationPrincipal SecurityUser user) {
        return R.ok(metadataService.createDef(user.getTenantId(), user.getUserId(), req));
    }

    @DeleteMapping("/association-defs/{id}")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<Void> deleteDef(@PathVariable Long id,
                              @AuthenticationPrincipal SecurityUser user) {
        metadataService.deleteDef(user.getTenantId(), id, user.getUserId());
        return R.ok(null);
    }
}
