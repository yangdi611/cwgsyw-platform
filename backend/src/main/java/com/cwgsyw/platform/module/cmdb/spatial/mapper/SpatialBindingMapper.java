package com.cwgsyw.platform.module.cmdb.spatial.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.spatial.entity.SpatialBinding;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface SpatialBindingMapper extends BaseMapper<SpatialBinding> {
    @Delete("DELETE FROM ci_spatial_binding WHERE layout_version_id = #{versionId} AND tenant_id = #{tenantId}")
    int deleteByVersion(@Param("versionId") Long versionId, @Param("tenantId") String tenantId);
}
