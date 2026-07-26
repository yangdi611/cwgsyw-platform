package com.cwgsyw.platform.module.cmdb.spatial.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.spatial.entity.SpatialLayoutVersion;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SpatialLayoutVersionMapper extends BaseMapper<SpatialLayoutVersion> {
    @Select("SELECT id FROM ci_spatial_layout_version WHERE layout_id = #{layoutId} AND tenant_id = #{tenantId} AND state = 'DRAFT' FOR UPDATE")
    Long lockDraftId(@Param("layoutId") Long layoutId, @Param("tenantId") String tenantId);

    @Select("SELECT COALESCE(MAX(version_no), 0) FROM ci_spatial_layout_version WHERE layout_id = #{layoutId} AND tenant_id = #{tenantId} AND state = 'PUBLISHED'")
    int maxPublishedVersionNo(@Param("layoutId") Long layoutId, @Param("tenantId") String tenantId);

    @org.apache.ibatis.annotations.Update("""
        UPDATE ci_spatial_layout_version
        SET schema_version = #{schemaVersion},
            document_json = #{document, typeHandler=com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler},
            document_checksum = #{checksum}, element_count = #{elementCount},
            revision = revision + 1, updated_by = #{operatorId}, updated_at = #{updatedAt}
        WHERE id = #{versionId} AND tenant_id = #{tenantId} AND state = 'DRAFT' AND revision = #{revision}
        """)
    int updateDraftDocument(@Param("versionId") Long versionId, @Param("tenantId") String tenantId,
                            @Param("revision") Integer revision, @Param("schemaVersion") Integer schemaVersion,
                            @Param("document") JsonNode document, @Param("checksum") String checksum,
                            @Param("elementCount") int elementCount, @Param("operatorId") Long operatorId,
                            @Param("updatedAt") LocalDateTime updatedAt);
}
