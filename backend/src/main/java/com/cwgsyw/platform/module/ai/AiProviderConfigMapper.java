package com.cwgsyw.platform.module.ai;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.ai.entity.AiProviderConfig;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface AiProviderConfigMapper extends BaseMapper<AiProviderConfig> {
    @Select("SELECT * FROM ai_provider_config WHERE tenant_id = #{tenantId} ORDER BY provider")
    List<AiProviderConfig> findByTenant(@Param("tenantId") String tenantId);

    @Select("SELECT * FROM ai_provider_config WHERE tenant_id = #{tenantId} AND provider = #{provider}")
    AiProviderConfig findByTenantAndProvider(@Param("tenantId") String tenantId, @Param("provider") String provider);
}
