package com.cwgsyw.platform.module.user;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.user.entity.User;
import org.apache.ibatis.annotations.*;
import java.util.Optional;

@Mapper
public interface UserMapper extends BaseMapper<User> {
    @Select("SELECT * FROM sys_user WHERE username = #{username} AND is_deleted = false")
    Optional<User> findByUsername(String username);

    @Update("""
        UPDATE sys_user
           SET group_id = NULL,
               updated_by = #{operatorId},
               updated_at = NOW()
         WHERE id = #{userId}
           AND tenant_id = #{tenantId}
           AND group_id = #{groupId}
           AND is_deleted = false
        """)
    int clearPrimaryGroup(@Param("tenantId") String tenantId,
                          @Param("userId") Long userId,
                          @Param("groupId") Long groupId,
                          @Param("operatorId") Long operatorId);
}
