package com.cwgsyw.platform.module.device;

import com.cwgsyw.platform.common.*;
import com.cwgsyw.platform.module.device.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/devices")
@RequiredArgsConstructor
public class DeviceController {
    private final DeviceService deviceService;

    @GetMapping
    @PreAuthorize("hasPermission('device', 'read')")
    public R<PageResult<DeviceVO>> list(
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) String deviceType,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        Long effectiveGroupId = "group".equals(cu.getGroupScope()) ? cu.getGroupId() : groupId;
        return R.ok(deviceService.list(effectiveGroupId, deviceType, category, page, size, cu.getTenantId()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasPermission('device', 'read')")
    public R<DeviceVO> getById(@PathVariable Long id,
                               @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(deviceService.getById(id, cu.getTenantId(), cu.getGroupId(), cu.getGroupScope()));
    }

    @PostMapping
    @PreAuthorize("hasPermission('device', 'create')")
    public R<DeviceVO> create(@Valid @RequestBody CreateDeviceRequest req,
                              @AuthenticationPrincipal SecurityUser cu) {
        var device = deviceService.create(req, cu.getTenantId(), cu.getUserId());
        return R.ok(deviceService.getById(device.getId(), cu.getTenantId(), cu.getGroupId(), cu.getGroupScope()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('device', 'update')")
    public R<Void> update(@PathVariable Long id,
                          @RequestBody CreateDeviceRequest req,
                          @AuthenticationPrincipal SecurityUser cu) {
        deviceService.update(id, req, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('device', 'delete')")
    public R<Void> delete(@PathVariable Long id,
                          @AuthenticationPrincipal SecurityUser cu) {
        deviceService.delete(id, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }

    @PostMapping("/{deviceId}/credentials")
    @PreAuthorize("hasPermission('device', 'create')")
    public R<Void> addCredential(@PathVariable Long deviceId,
                                 @Valid @RequestBody CreateCredentialRequest req,
                                 @AuthenticationPrincipal SecurityUser cu) {
        deviceService.addCredential(deviceId, req, cu.getTenantId(), cu.getUserId(), cu.getGroupId());
        return R.ok();
    }

    @DeleteMapping("/credentials/{credentialId}")
    @PreAuthorize("hasPermission('device', 'delete')")
    public R<Void> deleteCredential(@PathVariable Long credentialId,
                                    @AuthenticationPrincipal SecurityUser cu) {
        deviceService.deleteCredential(credentialId, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }

    @GetMapping("/credentials/{credentialId}/reveal")
    @PreAuthorize("hasPermission('device', 'view_password')")
    public R<String> revealPassword(@PathVariable Long credentialId,
                                    @RequestParam(required = false) String clientPublicKey,
                                    @AuthenticationPrincipal SecurityUser cu,
                                    HttpServletRequest request) {
        String result = deviceService.revealPassword(credentialId, cu.getTenantId(),
            cu.getUserId(), cu.getGroupId(), cu.getGroupScope(),
            request.getRemoteAddr(), clientPublicKey);
        return R.ok(result);
    }
}
