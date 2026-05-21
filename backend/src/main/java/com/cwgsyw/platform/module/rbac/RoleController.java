package com.cwgsyw.platform.module.rbac;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.*;
import com.cwgsyw.platform.module.rbac.dto.AssignPermissionsRequest;
import com.cwgsyw.platform.module.rbac.entity.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/rbac")
@RequiredArgsConstructor
public class RoleController {
    private final SysRoleMapper roleMapper;
    private final SysPermissionMapper permMapper;
    private final SysResourceMapper resourceMapper;
    private final RbacService rbacService;

    @GetMapping("/roles")
    @PreAuthorize("hasPermission('role', 'read')")
    public R<PageResult<SysRole>> listRoles(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        return R.ok(PageResult.of(roleMapper.selectPage(new Page<>(page, size), null)));
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
                                     @RequestBody AssignPermissionsRequest req) {
        rbacService.assignPermissionsToRole(roleId, req.getPermissionIds());
        return R.ok();
    }
}
