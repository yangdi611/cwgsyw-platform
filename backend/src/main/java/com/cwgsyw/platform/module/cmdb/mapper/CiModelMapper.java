package com.cwgsyw.platform.module.cmdb.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.Optional;

@Mapper
public interface CiModelMapper extends BaseMapper<CiModel> {

    @Select("SELECT * FROM ci_model WHERE (model_id = #{name} OR name = #{name}) AND tenant_id = #{tenantId} AND NOT is_deleted")
    Optional<CiModel> findByName(@Param("name") String name, @Param("tenantId") String tenantId);
}
