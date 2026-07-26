package com.cwgsyw.platform.module.cmdb.spatial.controller;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.spatial.dto.*;
import com.cwgsyw.platform.module.cmdb.spatial.service.SpatialLayoutService;
import com.cwgsyw.platform.module.cmdb.spatial.service.SpatialAssetService;
import com.cwgsyw.platform.module.cmdb.spatial.service.SpatialRuntimeService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;
import java.io.InputStream;

/** Dedicated API boundary; existing CMDB controllers and routes are intentionally untouched. */
@RestController
@RequestMapping("/api/cmdb/spatial")
@RequiredArgsConstructor
public class SpatialLayoutController {
    private final SpatialLayoutService spatialLayoutService;
    private final SpatialAssetService spatialAssetService;
    private final SpatialRuntimeService spatialRuntimeService;

    @GetMapping("/layouts")
    @PreAuthorize("hasPermission('cmdb_spatial', 'read') and hasPermission('cmdb_instance', 'read')")
    public R<List<SpatialLayoutVO>> list(@RequestParam(defaultValue = "false") boolean includeArchived,
                                         @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialLayoutService.list(user.getTenantId(), includeArchived));
    }

    @GetMapping("/rooms")
    @PreAuthorize("hasPermission('cmdb_spatial', 'read') and hasPermission('cmdb_instance', 'read')")
    public R<List<SpatialRoomVO>> rooms(@RequestParam(required = false) String keyword,
                                        @RequestParam(defaultValue = "false") boolean configured,
                                        @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int size,
                                        @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialRuntimeService.rooms(keyword, configured, page, size, user.getTenantId()));
    }

    @PostMapping("/layouts")
    @PreAuthorize("hasPermission('cmdb_spatial', 'create') and hasPermission('cmdb_instance', 'read')")
    public R<SpatialLayoutVO> create(@Valid @RequestBody SpatialCreateLayoutRequest request,
                                     @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialLayoutService.create(request, user.getTenantId(), user.getUserId()));
    }

    @GetMapping("/rooms/{roomId}/published")
    @PreAuthorize("hasPermission('cmdb_spatial', 'read') and hasPermission('cmdb_instance', 'read')")
    public R<SpatialLayoutVersionVO> published(@PathVariable Long roomId, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialLayoutService.getPublishedByRoom(roomId, user.getTenantId()));
    }

    @GetMapping("/layouts/{layoutId}/draft")
    @PreAuthorize("hasPermission('cmdb_spatial', 'update') and hasPermission('cmdb_instance', 'read')")
    public R<SpatialLayoutVersionVO> draft(@PathVariable Long layoutId, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialLayoutService.getDraft(layoutId, user.getTenantId()));
    }

    @PutMapping("/layouts/{layoutId}/draft")
    @PreAuthorize("hasPermission('cmdb_spatial', 'update') and hasPermission('cmdb_instance', 'read')")
    public R<SpatialLayoutVersionVO> saveDraft(@PathVariable Long layoutId, @Valid @RequestBody SpatialSaveDraftRequest request,
                                                @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialLayoutService.saveDraft(layoutId, request, user.getTenantId(), user.getUserId()));
    }

    @PostMapping("/layouts/{layoutId}/draft/validate")
    @PreAuthorize("hasPermission('cmdb_spatial', 'update') and hasPermission('cmdb_instance', 'read')")
    public R<SpatialValidationResult> validate(@PathVariable Long layoutId, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialLayoutService.validateDraft(layoutId, user.getTenantId()));
    }

    @PostMapping("/layouts/{layoutId}/publish")
    @PreAuthorize("hasPermission('cmdb_spatial', 'publish') and hasPermission('cmdb_instance', 'read')")
    public R<SpatialLayoutVersionVO> publish(@PathVariable Long layoutId, @Valid @RequestBody SpatialPublishRequest request,
                                              @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialLayoutService.publish(layoutId, request, user.getTenantId(), user.getUserId()));
    }

    @GetMapping("/layouts/{layoutId}/versions")
    @PreAuthorize("hasPermission('cmdb_spatial', 'read') and hasPermission('cmdb_instance', 'read')")
    public R<List<SpatialLayoutVersionVO>> versions(@PathVariable Long layoutId, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialLayoutService.listVersions(layoutId, user.getTenantId()));
    }

    @GetMapping("/layouts/{layoutId}/versions/{versionId}")
    @PreAuthorize("hasPermission('cmdb_spatial', 'read') and hasPermission('cmdb_instance', 'read')")
    public R<SpatialLayoutVersionVO> version(@PathVariable Long layoutId, @PathVariable Long versionId,
                                              @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialLayoutService.getPublishedVersion(layoutId, versionId, user.getTenantId()));
    }

    @GetMapping("/layouts/{layoutId}/runtime")
    @PreAuthorize("hasPermission('cmdb_spatial', 'read') and hasPermission('cmdb_instance', 'read')")
    public R<SpatialRuntimeVO> runtime(@PathVariable Long layoutId, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialRuntimeService.runtime(layoutId, user.getTenantId()));
    }

    @GetMapping("/layouts/{layoutId}/rack-candidates")
    @PreAuthorize("hasPermission('cmdb_spatial', 'update') and hasPermission('cmdb_instance', 'read')")
    public R<List<SpatialCandidateVO>> rackCandidates(@PathVariable Long layoutId, @RequestParam(required = false) String keyword,
                                                       @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int size,
                                                       @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialRuntimeService.rackCandidates(layoutId, keyword, page, size, user.getTenantId()));
    }

    @GetMapping("/layouts/{layoutId}/facility-candidates")
    @PreAuthorize("hasPermission('cmdb_spatial', 'update') and hasPermission('cmdb_instance', 'read')")
    public R<List<SpatialCandidateVO>> facilityCandidates(@PathVariable Long layoutId, @RequestParam(required = false) String keyword,
                                                           @RequestParam(required = false) String modelId, @RequestParam(defaultValue = "1") int page,
                                                           @RequestParam(defaultValue = "20") int size, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialRuntimeService.facilityCandidates(layoutId, keyword, modelId, page, size, user.getTenantId()));
    }

    @GetMapping("/locate")
    @PreAuthorize("hasPermission('cmdb_spatial', 'read') and hasPermission('cmdb_instance', 'read')")
    public R<List<SpatialLocateVO>> locate(@RequestParam String keyword, @RequestParam(defaultValue = "20") int size,
                                            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialRuntimeService.locate(keyword, size, user.getTenantId()));
    }

    @GetMapping("/locate/by-ci/{ciId}")
    @PreAuthorize("hasPermission('cmdb_spatial', 'read') and hasPermission('cmdb_instance', 'read')")
    public R<List<SpatialLocateVO>> locateByCi(@PathVariable Long ciId, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialRuntimeService.locateByCi(ciId, user.getTenantId()));
    }

    @PostMapping("/layouts/{layoutId}/versions/{versionId}/restore")
    @PreAuthorize("hasPermission('cmdb_spatial', 'publish') and hasPermission('cmdb_instance', 'read')")
    public R<SpatialLayoutVersionVO> restore(@PathVariable Long layoutId, @PathVariable Long versionId,
                                              @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialLayoutService.restoreVersion(layoutId, versionId, user.getTenantId(), user.getUserId()));
    }

    @PostMapping("/layouts/{layoutId}/archive")
    @PreAuthorize("hasPermission('cmdb_spatial', 'publish') and hasPermission('cmdb_instance', 'read')")
    public R<Void> archive(@PathVariable Long layoutId, @AuthenticationPrincipal SecurityUser user) {
        spatialLayoutService.archive(layoutId, user.getTenantId(), user.getUserId());
        return R.ok();
    }

    @PostMapping("/layouts/{layoutId}/restore-active")
    @PreAuthorize("hasPermission('cmdb_spatial', 'publish') and hasPermission('cmdb_instance', 'read')")
    public R<Void> restoreActive(@PathVariable Long layoutId, @AuthenticationPrincipal SecurityUser user) {
        spatialLayoutService.restoreActive(layoutId, user.getTenantId(), user.getUserId());
        return R.ok();
    }

    @DeleteMapping("/layouts/{layoutId}")
    @PreAuthorize("hasPermission('cmdb_spatial', 'delete') and hasPermission('cmdb_instance', 'read')")
    public R<Void> delete(@PathVariable Long layoutId, @AuthenticationPrincipal SecurityUser user) {
        spatialLayoutService.deleteEmpty(layoutId, user.getTenantId(), user.getUserId());
        return R.ok();
    }

    @PostMapping("/layouts/{layoutId}/assets/reference")
    @PreAuthorize("hasPermission('cmdb_spatial', 'update') and hasPermission('cmdb_instance', 'read')")
    public R<SpatialAssetVO> uploadReference(@PathVariable Long layoutId, @RequestParam("file") MultipartFile file,
                                              @AuthenticationPrincipal SecurityUser user) {
        return R.ok(spatialAssetService.uploadReference(layoutId, file, user.getTenantId(), user.getUserId()));
    }

    @GetMapping("/assets/{assetId}/content")
    @PreAuthorize("(hasPermission('cmdb_spatial', 'read') or hasPermission('cmdb_spatial', 'update')) and hasPermission('cmdb_instance', 'read')")
    public ResponseEntity<byte[]> assetContent(@PathVariable Long assetId, @AuthenticationPrincipal SecurityUser user) throws Exception {
        var asset = spatialAssetService.requireReadable(assetId, user.getTenantId());
        boolean canUpdate = user.getPermissions().contains("cmdb_spatial:update");
        try (InputStream stream = spatialAssetService.open(assetId, user.getTenantId(), canUpdate)) {
            return ResponseEntity.ok().contentType(MediaType.parseMediaType(asset.getContentType()))
                    .header(HttpHeaders.CACHE_CONTROL, "private, max-age=86400")
                    .header("X-Content-Type-Options", "nosniff").body(stream.readAllBytes());
        }
    }

    @DeleteMapping("/assets/{assetId}")
    @PreAuthorize("hasPermission('cmdb_spatial', 'delete') and hasPermission('cmdb_instance', 'read')")
    public R<Void> deleteAsset(@PathVariable Long assetId, @AuthenticationPrincipal SecurityUser user) {
        spatialAssetService.delete(assetId, user.getTenantId(), user.getUserId());
        return R.ok();
    }
}
