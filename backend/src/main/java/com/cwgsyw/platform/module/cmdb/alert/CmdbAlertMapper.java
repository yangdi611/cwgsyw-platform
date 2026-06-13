package com.cwgsyw.platform.module.cmdb.alert;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.alert.entity.CmdbAlert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.Optional;

@Mapper
public interface CmdbAlertMapper extends BaseMapper<CmdbAlert> {

    @Select("SELECT * FROM cmdb_alert WHERE fingerprint = #{fingerprint} AND tenant_id = #{tenantId} AND NOT is_deleted")
    Optional<CmdbAlert> findByFingerprint(@Param("fingerprint") String fingerprint,
                                          @Param("tenantId") String tenantId);

    @Select("SELECT COUNT(*) FROM cmdb_alert WHERE ci_instance_id = #{instanceId} AND status = 'firing' AND NOT is_deleted AND tenant_id = #{tenantId}")
    long countFiringByInstance(@Param("instanceId") Long instanceId,
                               @Param("tenantId") String tenantId);
}
