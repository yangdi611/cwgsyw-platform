package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CiInstanceMapper extends BaseMapper<CiInstance> {

    @Select("SELECT * FROM ci_instance WHERE tenant_id = #{tenantId} AND model_id = #{modelId} AND is_deleted = FALSE ORDER BY created_at DESC")
    Page<CiInstance> findByModel(Page<CiInstance> page,
                                  @Param("tenantId") String tenantId,
                                  @Param("modelId") String modelId);

    @Select("SELECT COUNT(*) FROM ci_instance WHERE tenant_id = #{tenantId} AND model_id = #{modelId} AND is_deleted = FALSE AND attrs ->> #{fieldKey} = #{value} AND id != #{excludeId}")
    int countByFieldValue(@Param("tenantId") String tenantId,
                           @Param("modelId") String modelId,
                           @Param("fieldKey") String fieldKey,
                           @Param("value") String value,
                           @Param("excludeId") Long excludeId);
}
