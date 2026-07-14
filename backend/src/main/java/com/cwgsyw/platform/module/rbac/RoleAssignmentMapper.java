package com.cwgsyw.platform.module.rbac;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.rbac.entity.RoleAssignment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface RoleAssignmentMapper extends BaseMapper<RoleAssignment> {
    @Select("""
        SELECT DISTINCT ra.role_id FROM sys_role_assignment ra
        JOIN sys_role r ON r.id = ra.role_id
          AND r.tenant_id = ra.tenant_id
          AND r.is_deleted = false
        WHERE ra.tenant_id = #{tenantId}
          AND ra.user_id = #{userId}
          AND ra.is_deleted = false
          AND (ra.valid_from IS NULL OR ra.valid_from <= NOW())
          AND (ra.valid_until IS NULL OR ra.valid_until > NOW())
          AND (
            ra.scope_type IN ('platform', 'tenant')
            OR (
              ra.scope_type = 'group'
              AND ra.scope_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM sys_group g
                WHERE g.id = ra.scope_id
                  AND g.tenant_id = ra.tenant_id
                  AND g.is_deleted = false
                  AND g.group_type = 'business'
              )
              AND EXISTS (
                SELECT 1 FROM sys_user_group_membership gm
                WHERE gm.tenant_id = ra.tenant_id
                  AND gm.user_id = ra.user_id
                  AND gm.group_id = ra.scope_id
                  AND gm.is_deleted = false
              )
            )
          )
        """)
    List<Long> findEffectiveRoleIds(String tenantId, Long userId);

    @Select("""
        SELECT DISTINCT ra.scope_type FROM sys_role_assignment ra
        JOIN sys_role r ON r.id = ra.role_id
          AND r.tenant_id = ra.tenant_id
          AND r.is_deleted = false
        WHERE ra.tenant_id = #{tenantId}
          AND ra.user_id = #{userId}
          AND ra.is_deleted = false
          AND (ra.valid_from IS NULL OR ra.valid_from <= NOW())
          AND (ra.valid_until IS NULL OR ra.valid_until > NOW())
          AND (
            ra.scope_type IN ('platform', 'tenant')
            OR (
              ra.scope_type = 'group'
              AND ra.scope_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM sys_group g
                WHERE g.id = ra.scope_id
                  AND g.tenant_id = ra.tenant_id
                  AND g.is_deleted = false
                  AND g.group_type = 'business'
              )
              AND EXISTS (
                SELECT 1 FROM sys_user_group_membership gm
                WHERE gm.tenant_id = ra.tenant_id
                  AND gm.user_id = ra.user_id
                  AND gm.group_id = ra.scope_id
                  AND gm.is_deleted = false
              )
            )
          )
        """)
    List<String> findEffectiveScopes(String tenantId, Long userId);

    @Select("""
        SELECT DISTINCT ra.scope_type FROM sys_role_assignment ra
        JOIN sys_role r ON r.id = ra.role_id
          AND r.tenant_id = ra.tenant_id
          AND r.is_deleted = false
        JOIN sys_role_permission rp ON rp.role_id = ra.role_id
        JOIN sys_permission p ON p.id = rp.permission_id
          AND p.code = #{permissionCode}
        WHERE ra.tenant_id = #{tenantId}
          AND ra.user_id = #{userId}
          AND ra.is_deleted = false
          AND (ra.valid_from IS NULL OR ra.valid_from <= NOW())
          AND (ra.valid_until IS NULL OR ra.valid_until > NOW())
          AND (
            ra.scope_type IN ('platform', 'tenant')
            OR (
              ra.scope_type = 'group'
              AND ra.scope_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM sys_group g
                WHERE g.id = ra.scope_id
                  AND g.tenant_id = ra.tenant_id
                  AND g.is_deleted = false
                  AND g.group_type = 'business'
              )
              AND EXISTS (
                SELECT 1 FROM sys_user_group_membership gm
                WHERE gm.tenant_id = ra.tenant_id
                  AND gm.user_id = ra.user_id
                  AND gm.group_id = ra.scope_id
                  AND gm.is_deleted = false
              )
            )
          )
        """)
    List<String> findEffectiveScopesForPermission(@Param("tenantId") String tenantId,
                                                   @Param("userId") Long userId,
                                                   @Param("permissionCode") String permissionCode);

    @Update("""
        UPDATE sys_role_assignment
           SET is_deleted = true,
               deleted_at = NOW(),
               deleted_by = #{operatorId},
               updated_at = NOW(),
               updated_by = #{operatorId}
         WHERE id = #{assignmentId}
           AND tenant_id = #{tenantId}
           AND user_id = #{userId}
           AND scope_type = 'group'
           AND scope_id = #{groupId}
           AND is_deleted = false
        """)
    int softDeleteActiveGroupAssignment(@Param("assignmentId") Long assignmentId,
                                        @Param("tenantId") String tenantId,
                                        @Param("userId") Long userId,
                                        @Param("groupId") Long groupId,
                                        @Param("operatorId") Long operatorId);

    @Update("""
        UPDATE sys_role_assignment
           SET is_deleted = true,
               deleted_at = NOW(),
               deleted_by = #{operatorId},
               updated_at = NOW(),
               updated_by = #{operatorId}
         WHERE id = #{assignmentId}
           AND tenant_id = #{tenantId}
           AND user_id = #{userId}
           AND is_deleted = false
        """)
    int softDeleteActiveAssignment(@Param("assignmentId") Long assignmentId,
                                   @Param("tenantId") String tenantId,
                                   @Param("userId") Long userId,
                                   @Param("operatorId") Long operatorId);
}
