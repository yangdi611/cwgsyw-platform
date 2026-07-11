package com.cwgsyw.platform.module.org;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.org.dto.GroupMembershipRequest;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.org.entity.UserGroupMembership;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.rbac.RoleAssignmentMapper;
import com.cwgsyw.platform.module.rbac.SysRoleMapper;
import com.cwgsyw.platform.module.rbac.SysUserRoleMapper;
import com.cwgsyw.platform.module.rbac.entity.SysRole;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GroupMembershipServiceTest {
    @Mock UserGroupMembershipMapper membershipMapper;
    @Mock UserMapper userMapper;
    @Mock GroupMapper groupMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock RbacService rbacService;
    @Mock SysRoleMapper roleMapper;
    @Mock RoleAssignmentMapper roleAssignmentMapper;
    @Mock SysUserRoleMapper userRoleMapper;

    private GroupMembershipService service;

    @BeforeEach
    void setUp() {
        service = new GroupMembershipService(membershipMapper, userMapper, groupMapper, auditLogMapper,
            rbacService, roleMapper, roleAssignmentMapper, userRoleMapper);
    }

    @Test
    void unassignedGroupMustBePrimary() {
        stubNonSuperAdmin(user(8L));
        when(groupMapper.selectById(9L)).thenReturn(group(9L, "unassigned"));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
            () -> service.add(8L, request(9L, "member", false), "default", 1L));

        assertEquals("未分配组只能作为账户主组", error.getMessage());
        verify(membershipMapper, never()).insert(any(UserGroupMembership.class));
    }

    @Test
    void unassignedGroupCannotHaveLeader() {
        stubNonSuperAdmin(user(8L));
        when(groupMapper.selectById(9L)).thenReturn(group(9L, "unassigned"));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
            () -> service.add(8L, request(9L, "leader", true), "default", 1L));

        assertEquals("未分配组不能设置组长", error.getMessage());
        verify(membershipMapper, never()).insert(any(UserGroupMembership.class));
    }

    @Test
    void groupScopedRoleCannotMoveToUnassignedGroup() {
        stubNonSuperAdmin(user(8L));
        when(groupMapper.selectById(9L)).thenReturn(group(9L, "unassigned"));
        when(membershipMapper.selectList(any())).thenReturn(List.of());
        when(rbacService.getUserRoleIds(8L)).thenReturn(List.of(7L));
        SysRole groupRole = new SysRole();
        groupRole.setId(7L);
        groupRole.setScope("group");
        when(roleMapper.selectById(7L)).thenReturn(groupRole);

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
            () -> service.add(8L, request(9L, "member", true), "default", 1L));

        assertEquals("用户持有组作用域角色，必须选择真实业务组", error.getMessage());
        verify(membershipMapper, never()).insert(any(UserGroupMembership.class));
    }

    @Test
    void superAdminMustRemainGroupless() {
        User user = user(1L);
        when(userMapper.selectById(1L)).thenReturn(user);
        when(groupMapper.selectById(2L)).thenReturn(group(2L, "business"));
        when(userRoleMapper.findRoleIdsByUserId(1L)).thenReturn(List.of(1L));
        when(roleAssignmentMapper.findEffectiveRoleIds("default", 1L)).thenReturn(List.of());
        SysRole role = new SysRole();
        role.setId(1L);
        role.setCode("super_admin");
        when(roleMapper.selectBatchIds(anyCollection())).thenReturn(List.of(role));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
            () -> service.add(1L, request(2L, "member", true), "default", 1L));

        assertEquals("超级管理员必须保持无组状态", error.getMessage());
        verify(membershipMapper, never()).insert(any(UserGroupMembership.class));
    }

    private void stubNonSuperAdmin(User user) {
        when(userMapper.selectById(user.getId())).thenReturn(user);
        when(userRoleMapper.findRoleIdsByUserId(user.getId())).thenReturn(List.of());
        when(roleAssignmentMapper.findEffectiveRoleIds("default", user.getId())).thenReturn(List.of());
    }

    private User user(Long id) {
        User user = new User();
        user.setId(id);
        user.setTenantId("default");
        return user;
    }

    private Group group(Long id, String type) {
        Group group = new Group();
        group.setId(id);
        group.setTenantId("default");
        group.setGroupType(type);
        return group;
    }

    private GroupMembershipRequest request(Long groupId, String role, boolean primary) {
        GroupMembershipRequest request = new GroupMembershipRequest();
        request.setGroupId(groupId);
        request.setMembershipRole(role);
        request.setPrimary(primary);
        return request;
    }
}
