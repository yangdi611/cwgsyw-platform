package com.cwgsyw.platform.module.rbac;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.rbac.entity.RoleAssignment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface RoleAssignmentMapper extends BaseMapper<RoleAssignment> {
    @Select("""
        SELECT DISTINCT role_id FROM sys_role_assignment
        WHERE tenant_id = #{tenantId}
          AND user_id = #{userId}
          AND is_deleted = false
          AND (valid_from IS NULL OR valid_from <= NOW())
          AND (valid_until IS NULL OR valid_until > NOW())
        """)
    List<Long> findEffectiveRoleIds(String tenantId, Long userId);

    @Select("""
        SELECT DISTINCT scope_type FROM sys_role_assignment
        WHERE tenant_id = #{tenantId}
          AND user_id = #{userId}
          AND is_deleted = false
          AND (valid_from IS NULL OR valid_from <= NOW())
          AND (valid_until IS NULL OR valid_until > NOW())
        """)
    List<String> findEffectiveScopes(String tenantId, Long userId);
}
