package com.cwgsyw.platform.module.rbac;

import com.cwgsyw.platform.config.AuthorizationProperties;
import com.cwgsyw.platform.module.authorization.AuthorizationModeService;
import com.cwgsyw.platform.module.rbac.entity.SysPermission;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RbacServiceAuthorizationModeTest {
    @Mock SysUserRoleMapper userRoleMapper;
    @Mock SysRolePermissionMapper rolePermissionMapper;
    @Mock SysPermissionMapper permissionMapper;
    @Mock SysRoleMapper roleMapper;
    @Mock SysResourceMapper resourceMapper;
    @Mock RoleAssignmentService roleAssignmentService;
    @Mock UserMapper userMapper;
    @Mock AuthorizationModeService authorizationModeService;

    private AuthorizationProperties properties;
    private RbacService service;

    @BeforeEach
    void setUp() {
        properties = new AuthorizationProperties();
        service = new RbacService(userRoleMapper, rolePermissionMapper, permissionMapper, roleMapper,
            resourceMapper, roleAssignmentService, authorizationModeService, userMapper);
    }

    @Test
    void legacyReadsOnlyLegacyRoles() {
        when(userRoleMapper.findRoleIdsByUserId(7L)).thenReturn(List.of(1L));
        User user = user();
        when(userMapper.selectById(7L)).thenReturn(user);
        when(authorizationModeService.effectiveMode("default"))
            .thenReturn(AuthorizationModeService.EffectiveMode.LEGACY);
        when(rolePermissionMapper.findPermissionIdsByRoleIds(List.of(1L))).thenReturn(List.of(11L));
        SysPermission permission = permission(11L, "wiki:read");
        when(permissionMapper.selectBatchIds(List.of(11L))).thenReturn(List.of(permission));

        assertEquals(java.util.Set.of("wiki:read"), service.getUserPermissions(7L));
        verifyNoInteractions(roleAssignmentService);
    }

    @Test
    void legacyAclRoleIdsAlwaysComeFromLegacyTable() {
        when(userRoleMapper.findRoleIdsByUserId(7L)).thenReturn(List.of(1L));
        User user = user();
        when(userMapper.selectById(7L)).thenReturn(user);
        when(authorizationModeService.isEnforced("default")).thenReturn(false);

        assertEquals(List.of(1L), service.getUserRoleIds(7L));
        verifyNoInteractions(roleAssignmentService);
    }

    @Test
    void enforcedDoesNotReplaceLegacyAclRoleIds() {
        User user = user();
        when(userMapper.selectById(7L)).thenReturn(user);
        when(authorizationModeService.isEnforced("default")).thenReturn(true);
        when(roleAssignmentService.findEffectiveRoleIds(7L, "default")).thenReturn(List.of(2L));

        assertEquals(List.of(2L), service.getUserRoleIds(7L));
        verifyNoInteractions(userRoleMapper);
    }

    @Test
    void enforcedPermissionsComeOnlyFromAssignments() {
        User user = user();
        when(userMapper.selectById(7L)).thenReturn(user);
        when(authorizationModeService.effectiveMode("default"))
            .thenReturn(AuthorizationModeService.EffectiveMode.ENFORCED);
        when(roleAssignmentService.findEffectiveRoleIds(7L, "default")).thenReturn(List.of(2L));
        when(rolePermissionMapper.findPermissionIdsByRoleIds(List.of(2L))).thenReturn(List.of(21L));
        when(permissionMapper.selectBatchIds(List.of(21L))).thenReturn(List.of(permission(21L, "wiki:update")));

        assertEquals(java.util.Set.of("wiki:update"), service.getUserPermissions(7L));
        verifyNoInteractions(userRoleMapper);
    }

    @Test
    void shadowStillReturnsLegacyPermissions() {
        when(userRoleMapper.findRoleIdsByUserId(7L)).thenReturn(List.of(1L));
        when(rolePermissionMapper.findPermissionIdsByRoleIds(List.of(1L))).thenReturn(List.of(11L));
        when(permissionMapper.selectBatchIds(List.of(11L))).thenReturn(List.of(permission(11L, "wiki:read")));
        when(userMapper.selectById(7L)).thenReturn(user());
        when(authorizationModeService.effectiveMode("default"))
            .thenReturn(AuthorizationModeService.EffectiveMode.SHADOW);
        when(roleAssignmentService.findEffectiveRoleIds(7L, "default")).thenReturn(List.of());

        assertEquals(java.util.Set.of("wiki:read"), service.getUserPermissions(7L));
    }

    private SysPermission permission(Long id, String code) {
        SysPermission permission = new SysPermission();
        permission.setId(id);
        permission.setCode(code);
        return permission;
    }

    private User user() {
        User user = new User();
        user.setId(7L);
        user.setTenantId("default");
        return user;
    }
}
