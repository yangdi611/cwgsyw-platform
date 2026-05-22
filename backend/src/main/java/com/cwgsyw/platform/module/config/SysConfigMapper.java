package com.cwgsyw.platform.module.config;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.config.entity.SysConfig;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface SysConfigMapper extends BaseMapper<SysConfig> {
    @Select("SELECT * FROM sys_config WHERE tenant_id = #{tenantId}")
    List<SysConfig> findByTenant(@Param("tenantId") String tenantId);

    @Select("SELECT config_value FROM sys_config WHERE tenant_id = #{tenantId} AND config_key = #{key}")
    String findValue(@Param("tenantId") String tenantId, @Param("key") String key);
}
