package com.cwgsyw.platform.module.cmdb.spatial.mapper;

import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** Read-only CMDB queries owned by the spatial boundary; it never writes existing CMDB tables. */
@Mapper
public interface SpatialCmdbReadMapper {
    @Select("SELECT * FROM ci_instance WHERE id = #{instanceId} AND tenant_id = #{tenantId} AND NOT is_deleted")
    CiInstance findActiveInstance(@Param("instanceId") Long instanceId, @Param("tenantId") String tenantId);

    @Select("""
        SELECT EXISTS (
          SELECT 1 FROM ci_instance_rel
          WHERE tenant_id = #{tenantId} AND NOT is_deleted
            AND src_id = #{roomInstanceId} AND dst_id = #{rackInstanceId}
            AND def_id = 'room_contains_rack'
        )
        """)
    boolean roomContainsRack(@Param("roomInstanceId") Long roomInstanceId,
                             @Param("rackInstanceId") Long rackInstanceId,
                             @Param("tenantId") String tenantId);
}
