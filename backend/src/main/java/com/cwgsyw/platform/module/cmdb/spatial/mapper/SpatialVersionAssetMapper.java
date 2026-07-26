package com.cwgsyw.platform.module.cmdb.spatial.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.spatial.entity.SpatialVersionAsset;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SpatialVersionAssetMapper extends BaseMapper<SpatialVersionAsset> {
    @Select("SELECT * FROM ci_spatial_version_asset WHERE layout_version_id = #{versionId} AND tenant_id = #{tenantId}")
    List<SpatialVersionAsset> findByVersion(@Param("versionId") Long versionId, @Param("tenantId") String tenantId);

    @Select("""
        SELECT EXISTS (
          SELECT 1
          FROM ci_spatial_version_asset asset_ref
          JOIN ci_spatial_layout_version version ON version.id = asset_ref.layout_version_id
          WHERE asset_ref.tenant_id = #{tenantId}
            AND asset_ref.asset_id = #{assetId}
            AND version.tenant_id = #{tenantId}
            AND version.state = 'PUBLISHED'
        )
        """)
    boolean isReferencedByPublishedVersion(@Param("assetId") Long assetId, @Param("tenantId") String tenantId);
}
