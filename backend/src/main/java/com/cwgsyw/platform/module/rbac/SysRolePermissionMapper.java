package com.cwgsyw.platform.module.rbac;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.rbac.entity.SysRolePermission;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface SysRolePermissionMapper extends BaseMapper<SysRolePermission> {
    @Select("<script>SELECT permission_id FROM sys_role_permission WHERE role_id IN " +
            "<foreach item='id' collection='roleIds' open='(' separator=',' close=')'>#{id}</foreach></script>")
    List<Long> findPermissionIdsByRoleIds(@Param("roleIds") List<Long> roleIds);
}
