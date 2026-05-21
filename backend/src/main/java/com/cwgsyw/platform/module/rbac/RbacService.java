package com.cwgsyw.platform.module.rbac;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.rbac.entity.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RbacService {
    private final SysUserRoleMapper userRoleMapper;
    private final SysRolePermissionMapper rolePermMapper;
    private final SysPermissionMapper permMapper;
    private final SysRoleMapper roleMapper;
    private final SysResourceMapper resourceMapper;

    public Set<String> getUserPermissions(Long userId) {
        List<Long> roleIds = userRoleMapper.findRoleIdsByUserId(userId);
        if (roleIds.isEmpty()) return Set.of();
        List<Long> permIds = rolePermMapper.findPermissionIdsByRoleIds(roleIds);
        if (permIds.isEmpty()) return Set.of();
        return permMapper.selectBatchIds(permIds).stream()
            .map(SysPermission::getCode)
            .collect(Collectors.toSet());
    }

    public List<SysResource> getAllResources() {
        return resourceMapper.selectList(null);
    }

    public List<SysPermission> getPermissionsByRoleId(Long roleId) {
        List<Long> permIds = rolePermMapper.findPermissionIdsByRoleIds(List.of(roleId));
        return permIds.isEmpty() ? List.of() : permMapper.selectBatchIds(permIds);
    }

    @Transactional
    public void assignPermissionsToRole(Long roleId, List<Long> permissionIds) {
        rolePermMapper.delete(new LambdaQueryWrapper<SysRolePermission>()
            .eq(SysRolePermission::getRoleId, roleId));
        permissionIds.forEach(pid -> {
            SysRolePermission srp = new SysRolePermission();
            srp.setRoleId(roleId);
            srp.setPermissionId(pid);
            rolePermMapper.insert(srp);
        });
    }

    @Transactional
    public void assignRolesToUser(Long userId, List<Long> roleIds) {
        userRoleMapper.delete(new LambdaQueryWrapper<SysUserRole>()
            .eq(SysUserRole::getUserId, userId));
        roleIds.forEach(rid -> {
            SysUserRole sur = new SysUserRole();
            sur.setUserId(userId);
            sur.setRoleId(rid);
            userRoleMapper.insert(sur);
        });
    }
}
