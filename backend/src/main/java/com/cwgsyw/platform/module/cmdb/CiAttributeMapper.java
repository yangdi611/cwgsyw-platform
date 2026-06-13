package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface CiAttributeMapper extends BaseMapper<CiAttribute> {
    @Select("SELECT * FROM ci_attribute WHERE tenant_id = #{tenantId} AND model_id = #{modelId} AND is_deleted = FALSE ORDER BY sort_order, id")
    List<CiAttribute> findByModel(@Param("tenantId") String tenantId, @Param("modelId") String modelId);
}
