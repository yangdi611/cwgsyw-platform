package com.cwgsyw.platform.module.org;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.org.entity.UserGroupMembership;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface UserGroupMembershipMapper extends BaseMapper<UserGroupMembership> {
    @Select("""
        SELECT group_id FROM sys_user_group_membership
        WHERE tenant_id = #{tenantId} AND user_id = #{userId} AND is_deleted = false
        """)
    List<Long> findActiveGroupIds(String tenantId, Long userId);

    @Select("""
        SELECT DISTINCT candidate.group_id
        FROM (
            SELECT group_id
            FROM sys_user_group_membership
            WHERE tenant_id = #{tenantId} AND user_id = #{userId} AND is_deleted = false
            UNION ALL
            SELECT group_id
            FROM sys_user
            WHERE tenant_id = #{tenantId} AND id = #{userId} AND is_deleted = false
              AND group_id IS NOT NULL
        ) candidate
        JOIN sys_group g ON g.id = candidate.group_id
          AND g.tenant_id = #{tenantId}
          AND g.is_deleted = false
          AND g.group_type = 'business'
        """)
    List<Long> findEffectiveActiveBusinessGroupIds(String tenantId, Long userId);

    @Select("""
        SELECT user_id FROM sys_user_group_membership
        WHERE tenant_id = #{tenantId} AND group_id = #{groupId} AND is_deleted = false
        UNION
        SELECT id FROM sys_user
        WHERE tenant_id = #{tenantId} AND group_id = #{groupId} AND is_deleted = false
        """)
    List<Long> findUserIdsByGroup(String tenantId, Long groupId);

    @Update("""
        UPDATE sys_user_group_membership
           SET is_deleted = true,
               deleted_at = NOW(),
               deleted_by = #{operatorId},
               updated_at = NOW(),
               updated_by = #{operatorId}
         WHERE id = #{membershipId}
           AND tenant_id = #{tenantId}
           AND user_id = #{userId}
           AND group_id = #{groupId}
           AND is_deleted = false
        """)
    int softDeleteActive(@Param("membershipId") Long membershipId,
                         @Param("tenantId") String tenantId,
                         @Param("userId") Long userId,
                         @Param("groupId") Long groupId,
                         @Param("operatorId") Long operatorId);
}
