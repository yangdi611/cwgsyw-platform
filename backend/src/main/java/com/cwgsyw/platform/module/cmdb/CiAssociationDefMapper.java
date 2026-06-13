package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationDef;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface CiAssociationDefMapper extends BaseMapper<CiAssociationDef> {
    @Select("SELECT * FROM ci_association_def WHERE tenant_id = #{tenantId} AND is_deleted = FALSE ORDER BY id")
    List<CiAssociationDef> findByTenant(@Param("tenantId") String tenantId);

    @Select("SELECT * FROM ci_association_def WHERE tenant_id = #{tenantId} AND (src_model_id = #{modelId} OR dst_model_id = #{modelId}) AND is_deleted = FALSE")
    List<CiAssociationDef> findByModel(@Param("tenantId") String tenantId, @Param("modelId") String modelId);
}
