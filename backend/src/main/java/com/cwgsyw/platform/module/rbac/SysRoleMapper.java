package com.cwgsyw.platform.module.rbac;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.rbac.entity.SysRole;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface SysRoleMapper extends BaseMapper<SysRole> {
    @Update("""
        UPDATE sys_role
           SET is_deleted = true,
               deleted_at = NOW(),
               deleted_by = #{operatorId},
               updated_at = NOW(),
               updated_by = #{operatorId}
         WHERE id = #{roleId}
           AND tenant_id = #{tenantId}
           AND is_deleted = false
           AND is_builtin = false
           AND role_type = 'functional'
        """)
    int softDeleteActiveCustomRole(@Param("roleId") Long roleId,
                                   @Param("tenantId") String tenantId,
                                   @Param("operatorId") Long operatorId);
}
