package com.cwgsyw.platform.module.authorization;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ScopedPermissionMapper {
    @Select("""
        SELECT DISTINCT a.id, a.scope_type, a.scope_id
        FROM sys_role_assignment a
        JOIN sys_role r ON r.id = a.role_id AND NOT r.is_deleted
        JOIN sys_role_permission rp ON rp.role_id = r.id
        JOIN sys_permission p ON p.id = rp.permission_id
        WHERE a.tenant_id = #{tenantId} AND a.user_id = #{userId} AND NOT a.is_deleted
          AND p.code = #{permissionCode}
          AND (a.valid_from IS NULL OR a.valid_from <= NOW())
          AND (a.valid_until IS NULL OR a.valid_until > NOW())
        """)
    List<ScopedPermissionRow> findAssignments(String tenantId, Long userId, String permissionCode);

    record ScopedPermissionRow(Long id, String scopeType, Long scopeId) {}
}
