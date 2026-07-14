package com.cwgsyw.platform.module.rbac;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.*;
import com.cwgsyw.platform.module.rbac.dto.AssignPermissionsRequest;
import com.cwgsyw.platform.module.rbac.entity.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import com.cwgsyw.platform.module.rbac.dto.CreateRoleRequest;
import com.cwgsyw.platform.module.rbac.dto.UpdateRoleRequest;
import java.util.List;

@RestController
@RequestMapping("/api/rbac")
@RequiredArgsConstructor
public class RoleController {
    private final SysRoleMapper roleMapper;
    private final SysPermissionMapper permMapper;
    private final SysResourceMapper resourceMapper;
    private final RbacService rbacService;
    private final RoleManagementService roleManagementService;

    @GetMapping("/roles")
    @PreAuthorize("hasPermission('role', 'read')")
    public R<PageResult<SysRole>> listRoles(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size,
            @AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(roleManagementService.list(page, size, currentUser.getTenantId()));
    }

    @PostMapping("/roles")
    @PreAuthorize("hasPermission('role', 'create')")
    public R<SysRole> createRole(@Valid @RequestBody CreateRoleRequest request,
                                 @AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(roleManagementService.create(request, currentUser.getTenantId(), currentUser.getUserId(),
            currentUser.getPermissions(), currentUser.getGroupScope()));
    }

    @PutMapping("/roles/{roleId}")
    @PreAuthorize("hasPermission('role', 'update')")
    public R<SysRole> updateRole(@PathVariable Long roleId,
                                 @Valid @RequestBody UpdateRoleRequest request,
                                 @AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(roleManagementService.update(roleId, request, currentUser.getTenantId(), currentUser.getUserId(),
            currentUser.getPermissions(), currentUser.getGroupScope()));
    }

    @DeleteMapping("/roles/{roleId}")
    @PreAuthorize("hasPermission('role', 'delete')")
    public R<Void> deleteRole(@PathVariable Long roleId,
                              @AuthenticationPrincipal SecurityUser currentUser) {
        roleManagementService.delete(roleId, currentUser.getTenantId(), currentUser.getUserId());
        return R.ok();
    }

    @GetMapping("/resources")
    @PreAuthorize("hasPermission('resource', 'read')")
    public R<List<SysResource>> listResources() {
        return R.ok(rbacService.getAllResources());
    }

    @GetMapping("/permissions")
    @PreAuthorize("hasPermission('resource', 'read')")
    public R<List<SysPermission>> listPermissions() {
        return R.ok(permMapper.selectList(null));
    }

    @GetMapping("/roles/{roleId}/permissions")
    @PreAuthorize("hasPermission('role', 'read')")
    public R<List<SysPermission>> getRolePermissions(@PathVariable Long roleId) {
        return R.ok(rbacService.getPermissionsByRoleId(roleId));
    }

    @PutMapping("/roles/{roleId}/permissions")
    @PreAuthorize("hasPermission('resource', 'assign')")
    public R<Void> assignPermissions(@PathVariable Long roleId,
                                     @RequestBody AssignPermissionsRequest req,
                                     @AuthenticationPrincipal SecurityUser currentUser) {
        roleManagementService.assignPermissions(roleId, req.getPermissionIds(),
            currentUser.getTenantId(), currentUser.getUserId(),
            currentUser.getPermissions(), currentUser.getGroupScope());
        return R.ok();
    }
}
