package com.cwgsyw.platform.module.user;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.user.entity.User;
import org.apache.ibatis.annotations.*;
import java.util.Optional;

@Mapper
public interface UserMapper extends BaseMapper<User> {
    @Select("SELECT * FROM sys_user WHERE username = #{username} AND is_deleted = false")
    Optional<User> findByUsername(String username);
}
