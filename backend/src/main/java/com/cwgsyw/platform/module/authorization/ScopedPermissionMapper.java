package com.cwgsyw.platform.module.authorization;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ScopedPermissionMapper {
    @Select("""
        SELECT DISTINCT a.id, a.scope_type, a.scope_id
        FROM sys_role_assignment a
        JOIN sys_role r ON r.id = a.role_id
          AND r.tenant_id = a.tenant_id
          AND r.is_deleted = false
        JOIN sys_role_permission rp ON rp.role_id = r.id
        JOIN sys_permission p ON p.id = rp.permission_id
        WHERE a.tenant_id = #{tenantId}
          AND a.user_id = #{userId}
          AND a.is_deleted = false
          AND p.code = #{permissionCode}
          AND (a.valid_from IS NULL OR a.valid_from <= NOW())
          AND (a.valid_until IS NULL OR a.valid_until > NOW())
          AND (
            a.scope_type IN ('platform', 'tenant')
            OR (
              a.scope_type = 'group'
              AND a.scope_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM sys_group g
                WHERE g.id = a.scope_id
                  AND g.tenant_id = a.tenant_id
                  AND g.is_deleted = false
                  AND g.group_type = 'business'
              )
              AND EXISTS (
                SELECT 1 FROM sys_user_group_membership gm
                WHERE gm.tenant_id = a.tenant_id
                  AND gm.user_id = a.user_id
                  AND gm.group_id = a.scope_id
                  AND gm.is_deleted = false
              )
            )
          )
        """)
    List<ScopedPermissionRow> findAssignments(String tenantId, Long userId, String permissionCode);

    @Select("""
        SELECT EXISTS (
            SELECT 1
            FROM sys_role_assignment a
            JOIN sys_role r ON r.id = a.role_id
              AND r.tenant_id = a.tenant_id AND NOT r.is_deleted
            JOIN sys_user_group_membership gm ON gm.tenant_id = a.tenant_id
              AND gm.user_id = a.user_id AND gm.group_id = a.scope_id AND NOT gm.is_deleted
            JOIN sys_group g ON g.id = a.scope_id AND g.tenant_id = a.tenant_id
              AND NOT g.is_deleted AND g.group_type = 'business'
            WHERE a.tenant_id = #{tenantId} AND a.user_id = #{userId}
              AND NOT a.is_deleted AND r.code = 'doc_admin' AND a.scope_type = 'group'
              AND (a.valid_from IS NULL OR a.valid_from <= NOW())
              AND (a.valid_until IS NULL OR a.valid_until > NOW())
        )
        """)
    boolean hasActiveDocumentAdminAssignment(String tenantId, Long userId);

    @Select("""
        SELECT EXISTS (
            SELECT 1
            FROM sys_role_assignment a
            JOIN sys_role r ON r.id = a.role_id
              AND r.tenant_id = a.tenant_id AND NOT r.is_deleted
            WHERE a.tenant_id = #{tenantId} AND a.user_id = #{userId}
              AND NOT a.is_deleted AND r.code = 'admin' AND a.scope_type = 'tenant'
              AND (a.valid_from IS NULL OR a.valid_from <= NOW())
              AND (a.valid_until IS NULL OR a.valid_until > NOW())
        )
        """)
    boolean hasActiveTenantAdminAssignment(String tenantId, Long userId);

    @Select("""
        SELECT EXISTS (
            SELECT 1
            FROM sys_role_assignment a
            JOIN sys_role r ON r.id = a.role_id
              AND r.tenant_id = a.tenant_id AND NOT r.is_deleted
            WHERE a.tenant_id = #{tenantId} AND a.user_id = #{userId}
              AND NOT a.is_deleted AND r.code = 'super_admin' AND a.scope_type = 'platform'
              AND (a.valid_from IS NULL OR a.valid_from <= NOW())
              AND (a.valid_until IS NULL OR a.valid_until > NOW())
        )
        """)
    boolean hasActivePlatformSuperAdminAssignment(String tenantId, Long userId);

    record ScopedPermissionRow(Long id, String scopeType, Long scopeId) {}
}
