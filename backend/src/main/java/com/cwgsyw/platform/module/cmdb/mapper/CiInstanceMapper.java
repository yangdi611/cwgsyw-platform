package com.cwgsyw.platform.module.cmdb.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CiInstanceMapper extends BaseMapper<CiInstance> {

    @Select("SELECT COUNT(*) FROM ci_instance WHERE model_id = #{modelId} AND tenant_id = #{tenantId} AND NOT is_deleted")
    long countByModel(@Param("modelId") String modelId, @Param("tenantId") String tenantId);
}
