package com.cwgsyw.platform.module.rbac;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.rbac.entity.SysUserRole;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface SysUserRoleMapper extends BaseMapper<SysUserRole> {
    @Select("SELECT role_id FROM sys_user_role WHERE user_id = #{userId}")
    List<Long> findRoleIdsByUserId(Long userId);

    @Select("<script>SELECT DISTINCT user_id FROM sys_user_role WHERE role_id IN " +
            "<foreach collection='roleIds' item='rid' open='(' separator=',' close=')'>#{rid}</foreach>" +
            "</script>")
    List<Long> findUserIdsByRoleIds(@Param("roleIds") List<Long> roleIds);
}
