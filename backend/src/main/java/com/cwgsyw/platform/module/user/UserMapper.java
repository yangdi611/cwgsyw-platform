package com.cwgsyw.platform.module.user;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.user.entity.User;
import org.apache.ibatis.annotations.*;
import java.time.LocalDateTime;
import java.util.Optional;

@Mapper
public interface UserMapper extends BaseMapper<User> {
    @Select("SELECT * FROM sys_user WHERE username = #{username} AND is_deleted = false")
    Optional<User> findByUsername(String username);

    @Update("UPDATE sys_user SET is_deleted = true, deleted_at = #{deletedAt}, deleted_by = #{deletedBy} WHERE id = #{id}")
    int softDeleteById(@Param("id") Long id, @Param("deletedAt") LocalDateTime deletedAt, @Param("deletedBy") Long deletedBy);
}
