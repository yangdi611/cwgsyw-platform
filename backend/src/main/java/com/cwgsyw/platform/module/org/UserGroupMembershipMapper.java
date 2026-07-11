package com.cwgsyw.platform.module.org;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.org.entity.UserGroupMembership;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface UserGroupMembershipMapper extends BaseMapper<UserGroupMembership> {
    @Select("""
        SELECT group_id FROM sys_user_group_membership
        WHERE tenant_id = #{tenantId} AND user_id = #{userId} AND is_deleted = false
        """)
    List<Long> findActiveGroupIds(String tenantId, Long userId);

    @Select("""
        SELECT user_id FROM sys_user_group_membership
        WHERE tenant_id = #{tenantId} AND group_id = #{groupId} AND is_deleted = false
        UNION
        SELECT id FROM sys_user
        WHERE tenant_id = #{tenantId} AND group_id = #{groupId} AND is_deleted = false
        """)
    List<Long> findUserIdsByGroup(String tenantId, Long groupId);
}
