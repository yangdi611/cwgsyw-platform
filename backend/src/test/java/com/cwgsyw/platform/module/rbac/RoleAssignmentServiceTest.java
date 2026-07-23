package com.cwgsyw.platform.module.rbac;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.authorization.AuthorizationWriteLockService;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.org.GroupLifecycleException;
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
    @Mock SysRoleMapper roleMapper;
    @Mock UserMapper userMapper;
    @Mock GroupMapper groupMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock SysRolePermissionMapper rolePermissionMapper;
    @Mock SysPermissionMapper permissionMapper;
    @Mock UserGroupMembershipMapper membershipMapper;
    @Mock AuthorizationWriteLockService authorizationWriteLockService;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;

    private RoleAssignmentService service;

    @BeforeEach
    void setUp() {
        service = new RoleAssignmentService(assignmentMapper, roleMapper, userMapper,
            groupMapper, auditLogMapper, rolePermissionMapper, permissionMapper, membershipMapper,
            authorizationWriteLockService, activeGroupReferenceValidator);
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
        when(activeGroupReferenceValidator.lockAndRequire("default", 9L))
            .thenThrow(new GroupLifecycleException(409, "GROUP_REFERENCE_INACTIVE", "目标用户组不存在、已归档或不可用于业务引用"));

        RoleAssignmentRequest request = new RoleAssignmentRequest();
        request.setRoleId(3L);
        request.setScopeType("group");
        request.setScopeId(9L);

        assertThrows(GroupLifecycleException.class, () -> service.add(
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
        when(activeGroupReferenceValidator.lockAndRequire("default", 9L)).thenReturn(group);
        when(membershipMapper.findActiveGroupIds("default", 8L)).thenReturn(List.of());

        RoleAssignmentRequest request = new RoleAssignmentRequest();
        request.setRoleId(3L);
        request.setScopeType("group");
        request.setScopeId(9L);

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () -> service.add(
            8L, request, "default", 1L, Set.of(), "platform", null));
        assertEquals("用户不属于目标作用域组", error.getMessage());
        verify(authorizationWriteLockService).lockUserAuthorization("default", 8L);
        verify(authorizationWriteLockService).lockGroupAssignment("default", 8L, 9L);
        verify(assignmentMapper, never()).insert(any(RoleAssignment.class));
    }

    @Test
    void groupAssignmentLocksBeforeMembershipRead() {
        User user = user(8L, "default");
        SysRole role = role(3L, "default");
        Group group = new Group();
        group.setId(9L);
        group.setTenantId("default");
        group.setGroupType("business");
        when(userMapper.selectById(8L)).thenReturn(user);
        when(roleMapper.selectById(3L)).thenReturn(role);
        when(activeGroupReferenceValidator.lockAndRequire("default", 9L)).thenReturn(group);
        when(membershipMapper.findActiveGroupIds("default", 8L)).thenReturn(List.of(9L));
        when(assignmentMapper.selectCount(any())).thenReturn(0L);
        when(assignmentMapper.insert(any(RoleAssignment.class))).thenReturn(1);
        when(auditLogMapper.insert(any(com.cwgsyw.platform.common.entity.AuditLog.class))).thenReturn(1);

        RoleAssignmentRequest request = new RoleAssignmentRequest();
        request.setRoleId(3L);
        request.setScopeType("group");
        request.setScopeId(9L);

        service.add(8L, request, "default", 1L, Set.of(), "platform", null);

        var inOrder = inOrder(authorizationWriteLockService, roleMapper, membershipMapper, assignmentMapper);
        inOrder.verify(authorizationWriteLockService).lockUserAuthorization("default", 8L);
        inOrder.verify(authorizationWriteLockService).lockRoleAuthorization("default", 3L);
        inOrder.verify(roleMapper).selectById(3L);
        inOrder.verify(authorizationWriteLockService).lockGroupAssignment("default", 8L, 9L);
        inOrder.verify(membershipMapper).findActiveGroupIds("default", 8L);
        inOrder.verify(assignmentMapper).insert(any(RoleAssignment.class));
    }

    @Test
    void failedSoftDeleteDoesNotWriteSuccessAudit() {
        RoleAssignment assignment = new RoleAssignment();
        assignment.setId(12L);
        assignment.setTenantId("default");
        assignment.setUserId(8L);
        assignment.setRoleId(3L);
        assignment.setScopeType("group");
        assignment.setScopeId(9L);
        when(assignmentMapper.selectById(12L)).thenReturn(assignment);
        when(roleMapper.selectById(3L)).thenReturn(role(3L, "default"));
        when(assignmentMapper.softDeleteActiveAssignment(12L, "default", 8L, 1L)).thenReturn(0);

        assertThrows(IllegalStateException.class,
            () -> service.remove(8L, 12L, "default", 1L));

        var removeLocks = inOrder(authorizationWriteLockService);
        removeLocks.verify(authorizationWriteLockService).lockUserAuthorization("default", 8L);
        removeLocks.verify(authorizationWriteLockService).lockRoleAuthorization("default", 3L);
        removeLocks.verify(authorizationWriteLockService).lockGroupAssignment("default", 8L, 9L);
        verify(auditLogMapper, never()).insert(any(com.cwgsyw.platform.common.entity.AuditLog.class));
    }

    @Test
    void legacyGroupCompatibilityAssignmentUsesLockAndFreshMembership() {
        User user = user(8L, "default");
        user.setGroupId(9L);
        SysRole role = role(3L, "default");
        role.setScope("group");
        when(roleMapper.selectById(3L)).thenReturn(role);
        when(userMapper.selectById(8L)).thenReturn(user);
        when(membershipMapper.findActiveGroupIds("default", 8L)).thenReturn(List.of());
        when(assignmentMapper.selectList(any())).thenReturn(List.of());

        service.replaceManagedRoles(8L, List.of(3L), "default", 9L, 1L);

        var inOrder = inOrder(authorizationWriteLockService, roleMapper, membershipMapper, assignmentMapper);
        inOrder.verify(authorizationWriteLockService).lockUserAuthorization("default", 8L);
        inOrder.verify(authorizationWriteLockService).lockRoleAuthorization("default", 3L);
        inOrder.verify(roleMapper).selectById(3L);
        inOrder.verify(authorizationWriteLockService).lockGroupAssignment("default", 8L, 9L);
        inOrder.verify(membershipMapper).findActiveGroupIds("default", 8L);
        verify(assignmentMapper, never()).insert(any(RoleAssignment.class));
    }

    @Test
    void replacingLegacyRolesLocksAndSoftDeletesExistingGeneratedGroupAssignment() {
        RoleAssignment generated = new RoleAssignment();
        generated.setId(12L);
        generated.setTenantId("default");
        generated.setUserId(8L);
        generated.setRoleId(3L);
        generated.setScopeType("group");
        generated.setScopeId(9L);
        generated.setOriginType("compatibility");
        when(assignmentMapper.selectList(any())).thenReturn(List.of(generated));
        when(assignmentMapper.softDeleteActiveAssignment(12L, "default", 8L, 1L)).thenReturn(1);

        service.replaceManagedRoles(8L, List.of(), "default", null, 1L);

        var replaceLocks = inOrder(authorizationWriteLockService);
        replaceLocks.verify(authorizationWriteLockService).lockUserAuthorization("default", 8L);
        replaceLocks.verify(authorizationWriteLockService).lockRoleAuthorization("default", 3L);
        replaceLocks.verify(authorizationWriteLockService).lockGroupAssignment("default", 8L, 9L);
        verify(assignmentMapper).softDeleteActiveAssignment(12L, "default", 8L, 1L);
        verify(assignmentMapper, never()).deleteById(any(java.io.Serializable.class));
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
        when(activeGroupReferenceValidator.lockAndRequire("default", 9L))
            .thenThrow(new GroupLifecycleException(409, "GROUP_REFERENCE_INACTIVE", "目标用户组不存在、已归档或不可用于业务引用"));

        RoleAssignmentRequest request = new RoleAssignmentRequest();
        request.setRoleId(3L);
        request.setScopeType("group");
        request.setScopeId(9L);

        GroupLifecycleException error = assertThrows(GroupLifecycleException.class, () -> service.add(
            8L, request, "default", 1L, Set.of(), "platform", null));
        assertEquals("目标用户组不存在、已归档或不可用于业务引用", error.getMessage());
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
