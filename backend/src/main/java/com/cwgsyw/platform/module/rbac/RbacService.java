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
import com.cwgsyw.platform.module.authorization.AuthorizationModeService;

@Service
@RequiredArgsConstructor
@Slf4j
public class RbacService {
    private final SysUserRoleMapper userRoleMapper;
    private final SysRolePermissionMapper rolePermMapper;
    private final SysPermissionMapper permMapper;
    private final SysRoleMapper roleMapper;
    private final SysResourceMapper resourceMapper;
    private final RoleAssignmentService roleAssignmentService;
    private final AuthorizationModeService authorizationModeService;
    private final UserMapper userMapper;

    public Set<String> getUserPermissions(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) return Set.of();
        AuthorizationModeService.EffectiveMode mode = authorizationModeService.effectiveMode(user.getTenantId());
        if (mode == AuthorizationModeService.EffectiveMode.ENFORCED) {
            List<Long> assignmentRoleIds = roleAssignmentService.findEffectiveRoleIds(userId, user.getTenantId());
            return permissionCodes(assignmentRoleIds);
        }

        List<Long> legacyRoleIds = userRoleMapper.findRoleIdsByUserId(userId);
        Set<String> legacyPermissions = permissionCodes(legacyRoleIds);
        if (mode == AuthorizationModeService.EffectiveMode.LEGACY) return legacyPermissions;

        List<Long> assignmentRoleIds = roleAssignmentService.findEffectiveRoleIds(userId, user.getTenantId());
        Set<String> assignmentPermissions = permissionCodes(assignmentRoleIds);
        if (!legacyPermissions.equals(assignmentPermissions)) {
            log.warn("[授权影子差异] userId={}, legacyPermissions={}, assignmentPermissions={}",
                userId, legacyPermissions, assignmentPermissions);
        }
        return legacyPermissions;
    }

    /** 返回用户的所有角色 ID（用于按角色匹配的 ACL 校验） */
    public List<Long> getUserRoleIds(Long userId) {
        User user = userMapper.selectById(userId);
        if (user != null && authorizationModeService.isEnforced(user.getTenantId())) {
            return roleAssignmentService.findEffectiveRoleIds(userId, user.getTenantId());
        }
        return userRoleMapper.findRoleIdsByUserId(userId);
    }

    /** 返回用户所有角色中优先级最高的 scope：platform > tenant > group */
    public String getHighestScope(Long userId) {
        User user = userMapper.selectById(userId);
        if (user != null && authorizationModeService.isEnforced(user.getTenantId())) {
            List<String> scopes = roleAssignmentService.findEffectiveScopes(userId, user.getTenantId());
            if (scopes.contains("platform")) return "platform";
            if (scopes.contains("tenant")) return "tenant";
            return "group";
        }
        List<Long> roleIds = userRoleMapper.findRoleIdsByUserId(userId);
        if (roleIds.isEmpty()) return "group";
        List<SysRole> roles = roleMapper.selectBatchIds(roleIds);
        if (roles.stream().anyMatch(r -> "platform".equals(r.getScope()))) return "platform";
        if (roles.stream().anyMatch(r -> "tenant".equals(r.getScope()))) return "tenant";
        return "group";
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
        assignRolesToUser(userId, roleIds, null);
    }

    @Transactional
    public void assignRolesToUser(Long userId, List<Long> roleIds, Long operatorId) {
        User user = userMapper.selectById(userId);
        if (user == null) throw new IllegalArgumentException("用户不存在");
        roleAssignmentService.replaceLegacyRoles(
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
