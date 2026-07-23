package com.cwgsyw.platform.module.rbac;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.authorization.AuthorizationWriteLockService;
import com.cwgsyw.platform.module.rbac.dto.CreateRoleRequest;
import com.cwgsyw.platform.module.rbac.entity.SysPermission;
import com.cwgsyw.platform.module.rbac.entity.SysRole;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoleManagementServiceTest {
    @Mock SysRoleMapper roleMapper;
    @Mock SysPermissionMapper permissionMapper;
    @Mock RoleAssignmentMapper assignmentMapper;
    @Mock RbacService rbacService;
    @Mock AuditLogMapper auditLogMapper;
    @Mock AuthorizationWriteLockService authorizationWriteLockService;
    @InjectMocks RoleManagementService service;

    @Test
    void roleListIncludesExplicitTotalWithoutPaginationInterceptor() {
        SysRole role = new SysRole();
        role.setId(1L);
        when(roleMapper.selectPage(any(Page.class), any())).thenReturn(new Page<SysRole>(1, 50, false)
            .setRecords(List.of(role)));
        when(roleMapper.selectCount(any())).thenReturn(5L);

        var result = service.list(1, 50, "default");

        assertEquals(5L, result.getTotal());
        assertEquals(1, result.getRecords().size());
    }

    @Test
    void nonPlatformOperatorCannotDelegateMissingPermission() {
        CreateRoleRequest request = new CreateRoleRequest();
        request.setName("文档管理");
        request.setCode("document_manager");
        request.setPermissionIds(List.of(9L));
        SysPermission permission = new SysPermission();
        permission.setId(9L);
        permission.setCode("wiki:manage_acl");
        when(permissionMapper.selectBatchIds(List.of(9L))).thenReturn(List.of(permission));

        assertThrows(IllegalArgumentException.class, () -> service.create(
            request, "default", 1L, Set.of("wiki:read"), "tenant"));
        verify(roleMapper, never()).insert(any(SysRole.class));
    }

    @Test
    void builtinRoleCannotBeDeleted() {
        SysRole role = new SysRole();
        role.setId(1L);
        role.setTenantId("default");
        role.setCode("admin");
        role.setIsBuiltin(true);
        role.setRoleType("management");
        when(roleMapper.selectById(1L)).thenReturn(role);

        assertThrows(IllegalArgumentException.class, () -> service.delete(1L, "default", 2L));
        verify(roleMapper, never()).deleteById(any(SysRole.class));
    }

    @Test
    void deleteLocksRoleThenRechecksAndSoftDeletesExactlyOneRow() {
        SysRole role = customRole(3L);
        when(roleMapper.selectById(3L)).thenReturn(role);
        when(assignmentMapper.selectCount(any())).thenReturn(0L);
        when(roleMapper.softDeleteActiveCustomRole(3L, "default", 2L)).thenReturn(1);
        when(auditLogMapper.insert(any(com.cwgsyw.platform.common.entity.AuditLog.class))).thenReturn(1);

        service.delete(3L, "default", 2L);

        var order = inOrder(authorizationWriteLockService, roleMapper, assignmentMapper);
        order.verify(authorizationWriteLockService).lockRoleAuthorization("default", 3L);
        order.verify(roleMapper).selectById(3L);
        order.verify(assignmentMapper).selectCount(any());
        order.verify(roleMapper).softDeleteActiveCustomRole(3L, "default", 2L);
        verify(roleMapper, never()).deleteById(any(SysRole.class));
    }

    @Test
    void zeroRowRoleDeleteDoesNotWriteSuccessAudit() {
        when(roleMapper.selectById(3L)).thenReturn(customRole(3L));
        when(assignmentMapper.selectCount(any())).thenReturn(0L);
        when(roleMapper.softDeleteActiveCustomRole(3L, "default", 2L)).thenReturn(0);

        assertThrows(IllegalStateException.class, () -> service.delete(3L, "default", 2L));

        verify(auditLogMapper, never()).insert(any(com.cwgsyw.platform.common.entity.AuditLog.class));
    }

    private SysRole customRole(Long id) {
        SysRole role = new SysRole();
        role.setId(id);
        role.setTenantId("default");
        role.setCode("wiki_reader");
        role.setIsBuiltin(false);
        role.setRoleType("functional");
        return role;
    }
}
