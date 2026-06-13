package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiAttributeGroup;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface CiAttributeGroupMapper extends BaseMapper<CiAttributeGroup> {
    @Select("SELECT * FROM ci_attribute_group WHERE tenant_id = #{tenantId} AND model_id = #{modelId} AND is_deleted = FALSE ORDER BY sort_order, id")
    List<CiAttributeGroup> findByModel(@Param("tenantId") String tenantId, @Param("modelId") String modelId);
}
