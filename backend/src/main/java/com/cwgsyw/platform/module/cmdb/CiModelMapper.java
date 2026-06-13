package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface CiModelMapper extends BaseMapper<CiModel> {
    @Select("SELECT * FROM ci_model WHERE tenant_id = #{tenantId} AND is_deleted = FALSE ORDER BY sort_order, id")
    List<CiModel> findByTenant(@Param("tenantId") String tenantId);
}
