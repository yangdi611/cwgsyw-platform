package com.cwgsyw.platform.module.cmdb.spatial.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.spatial.entity.SpatialLayout;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface SpatialLayoutMapper extends BaseMapper<SpatialLayout> {
    @Select("SELECT * FROM ci_spatial_layout WHERE id = #{layoutId} AND tenant_id = #{tenantId} AND NOT is_deleted FOR UPDATE")
    SpatialLayout findActiveForUpdate(@Param("layoutId") Long layoutId, @Param("tenantId") String tenantId);

    @Update("UPDATE ci_spatial_layout SET draft_version_id = NULL, updated_by = #{operatorId}, updated_at = NOW() WHERE id = #{layoutId} AND tenant_id = #{tenantId} AND NOT is_deleted")
    int clearDraftVersion(@Param("layoutId") Long layoutId, @Param("tenantId") String tenantId, @Param("operatorId") Long operatorId);
}
