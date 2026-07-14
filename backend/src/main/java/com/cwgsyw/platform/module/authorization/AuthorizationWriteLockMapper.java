package com.cwgsyw.platform.module.authorization;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AuthorizationWriteLockMapper {
    @Select("SELECT pg_advisory_xact_lock(#{lockKey})")
    Object lock(@Param("lockKey") long lockKey);
}
