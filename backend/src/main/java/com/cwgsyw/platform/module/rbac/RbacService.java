package com.cwgsyw.platform.module.rbac;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.rbac.entity.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;

@Service
@RequiredArgsConstructor
@Slf4j
public class RbacService {
    private final SysRolePermissionMapper rolePermMapper;
    private final SysPermissionMapper permMapper;
    private final SysRoleMapper roleMapper;
    private final SysResourceMapper resourceMapper;
    private final RoleAssignmentService roleAssignmentService;
    private final UserMapper userMapper;

    public Set<String> getUserPermissions(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) return Set.of();
        List<Long> assignmentRoleIds = roleAssignmentService.findEffectiveRoleIds(userId, user.getTenantId());
        return permissionCodes(assignmentRoleIds);
    }

    /** 返回用户的所有角色 ID（用于按角色匹配的 ACL 校验） */
    public List<Long> getUserRoleIds(Long userId) {
        User user = userMapper.selectById(userId);
        return user == null ? List.of() : roleAssignmentService.findEffectiveRoleIds(userId, user.getTenantId());
    }

    /** 返回用户所有角色中优先级最高的 scope：platform > tenant > group */
    public String getHighestScope(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) return "group";
        List<String> scopes = roleAssignmentService.findEffectiveScopes(userId, user.getTenantId());
        if (scopes.contains("platform")) return "platform";
        if (scopes.contains("tenant")) return "tenant";
        return "group";
    }

    public List<SysResource> getAllResources() {
        return resourceMapper.selectList(null);
    }

    public List<SysPermission> getPermissionsByRoleId(Long roleId, String tenantId) {
        SysRole role = roleMapper.selectOne(new LambdaQueryWrapper<SysRole>()
            .eq(SysRole::getId, roleId)
            .eq(SysRole::getTenantId, tenantId));
        if (role == null) throw new IllegalArgumentException("角色不存在");
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
        assignRolesToUser(userId, roleIds, null);
    }

    @Transactional
    public void assignRolesToUser(Long userId, List<Long> roleIds, Long operatorId) {
        User user = userMapper.selectById(userId);
        if (user == null) throw new IllegalArgumentException("用户不存在");
        roleAssignmentService.replaceManagedRoles(
            userId, roleIds, user.getTenantId(), user.getGroupId(), operatorId);
    }

    private Set<String> permissionCodes(List<Long> roleIds) {
        if (roleIds.isEmpty()) return Set.of();
        List<Long> permissionIds = rolePermMapper.findPermissionIdsByRoleIds(roleIds);
        if (permissionIds.isEmpty()) return Set.of();
        return permMapper.selectBatchIds(permissionIds).stream()
            .map(SysPermission::getCode)
            .collect(Collectors.toSet());
    }

}
