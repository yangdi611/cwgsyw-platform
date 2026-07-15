package com.cwgsyw.platform.module.cmdb.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CiInstanceMapper extends BaseMapper<CiInstance> {

    @Select("SELECT COUNT(*) FROM ci_instance WHERE model_id = #{modelId} AND tenant_id = #{tenantId} AND NOT is_deleted")
    long countByModel(@Param("modelId") String modelId, @Param("tenantId") String tenantId);

    /**
     * 锁定活跃 CI，串行化实例删除与设备关联创建，避免两条事务交错产生孤儿设备引用。
     */
    @Select("SELECT * FROM ci_instance WHERE id = #{id} AND tenant_id = #{tenantId} AND NOT is_deleted FOR UPDATE")
    CiInstance findActiveByIdForUpdate(@Param("id") Long id, @Param("tenantId") String tenantId);
}
