package com.cwgsyw.platform.module.rbac;

import com.cwgsyw.platform.common.AuditLogMapper;
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
    @Mock SysUserRoleMapper userRoleMapper;
    @Mock RoleAssignmentMapper assignmentMapper;
    @Mock RbacService rbacService;
    @Mock AuditLogMapper auditLogMapper;
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
}
