package com.cwgsyw.platform.module.rbac;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.UserGroupMembershipMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.rbac.dto.RoleAssignmentRequest;
import com.cwgsyw.platform.module.rbac.entity.SysRole;
import com.cwgsyw.platform.module.rbac.entity.RoleAssignment;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoleAssignmentServiceTest {
    @Mock RoleAssignmentMapper assignmentMapper;
    @Mock SysUserRoleMapper userRoleMapper;
    @Mock SysRoleMapper roleMapper;
    @Mock UserMapper userMapper;
    @Mock GroupMapper groupMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock SysRolePermissionMapper rolePermissionMapper;
    @Mock SysPermissionMapper permissionMapper;
    @Mock UserGroupMembershipMapper membershipMapper;

    private RoleAssignmentService service;

    @BeforeEach
    void setUp() {
        service = new RoleAssignmentService(assignmentMapper, userRoleMapper, roleMapper, userMapper,
            groupMapper, auditLogMapper, rolePermissionMapper, permissionMapper, membershipMapper);
    }

    @Test
    void groupOperatorCannotAssignTenantScope() {
        User user = user(8L, "default");
        SysRole role = role(3L, "default");
        when(userMapper.selectById(8L)).thenReturn(user);
        when(roleMapper.selectById(3L)).thenReturn(role);

        RoleAssignmentRequest request = new RoleAssignmentRequest();
        request.setRoleId(3L);
        request.setScopeType("tenant");

        assertThrows(IllegalArgumentException.class, () -> service.add(
            8L, request, "default", 1L, Set.of(), "group", 5L));
        verify(assignmentMapper, never()).insert(any(RoleAssignment.class));
    }

    @Test
    void crossTenantGroupIsRejected() {
        User user = user(8L, "default");
        SysRole role = role(3L, "default");
        Group group = new Group();
        group.setId(9L);
        group.setTenantId("other");
        when(userMapper.selectById(8L)).thenReturn(user);
        when(roleMapper.selectById(3L)).thenReturn(role);
        when(groupMapper.selectById(9L)).thenReturn(group);

        RoleAssignmentRequest request = new RoleAssignmentRequest();
        request.setRoleId(3L);
        request.setScopeType("group");
        request.setScopeId(9L);

        assertThrows(IllegalArgumentException.class, () -> service.add(
            8L, request, "default", 1L, Set.of(), "platform", null));
        verify(assignmentMapper, never()).insert(any(RoleAssignment.class));
    }

    @Test
    void groupAssignmentRequiresTargetMembership() {
        User user = user(8L, "default");
        SysRole role = role(3L, "default");
        Group group = new Group();
        group.setId(9L);
        group.setTenantId("default");
        group.setGroupType("business");
        when(userMapper.selectById(8L)).thenReturn(user);
        when(roleMapper.selectById(3L)).thenReturn(role);
        when(groupMapper.selectById(9L)).thenReturn(group);
        when(membershipMapper.findActiveGroupIds("default", 8L)).thenReturn(List.of());

        RoleAssignmentRequest request = new RoleAssignmentRequest();
        request.setRoleId(3L);
        request.setScopeType("group");
        request.setScopeId(9L);

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () -> service.add(
            8L, request, "default", 1L, Set.of(), "platform", null));
        assertEquals("用户不属于目标作用域组", error.getMessage());
        verify(assignmentMapper, never()).insert(any(RoleAssignment.class));
    }

    @Test
    void unassignedGroupCannotBeRoleScope() {
        User user = user(8L, "default");
        SysRole role = role(3L, "default");
        Group group = new Group();
        group.setId(9L);
        group.setTenantId("default");
        group.setGroupType("unassigned");
        when(userMapper.selectById(8L)).thenReturn(user);
        when(roleMapper.selectById(3L)).thenReturn(role);
        when(groupMapper.selectById(9L)).thenReturn(group);

        RoleAssignmentRequest request = new RoleAssignmentRequest();
        request.setRoleId(3L);
        request.setScopeType("group");
        request.setScopeId(9L);

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () -> service.add(
            8L, request, "default", 1L, Set.of(), "platform", null));
        assertEquals("未分配组不能作为角色作用域", error.getMessage());
        verify(assignmentMapper, never()).insert(any(RoleAssignment.class));
    }

    private User user(Long id, String tenantId) {
        User user = new User();
        user.setId(id);
        user.setTenantId(tenantId);
        return user;
    }

    private SysRole role(Long id, String tenantId) {
        SysRole role = new SysRole();
        role.setId(id);
        role.setTenantId(tenantId);
        role.setCode("wiki_reader");
        role.setRoleType("functional");
        role.setIsBuiltin(false);
        return role;
    }
}
