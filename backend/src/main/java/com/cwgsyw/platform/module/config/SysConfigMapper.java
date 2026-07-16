package com.cwgsyw.platform.module.config;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.config.entity.SysConfig;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Insert;
import java.util.List;

@Mapper
public interface SysConfigMapper extends BaseMapper<SysConfig> {
    @Select("SELECT * FROM sys_config WHERE tenant_id = #{tenantId}")
    List<SysConfig> findByTenant(@Param("tenantId") String tenantId);

    @Select("SELECT config_value FROM sys_config WHERE tenant_id = #{tenantId} AND config_key = #{key}")
    String findValue(@Param("tenantId") String tenantId, @Param("key") String key);

    @Insert("""
        INSERT INTO sys_config (tenant_id, config_key, config_value, updated_at)
        VALUES (#{tenantId}, #{key}, #{value}, NOW())
        ON CONFLICT (tenant_id, config_key)
        DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW()
        """)
    int upsertValue(@Param("tenantId") String tenantId, @Param("key") String key,
                    @Param("value") String value);
}
