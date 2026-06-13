package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import org.apache.ibatis.annotations.*;

import java.util.Map;

@Mapper
public interface CiInstanceMapper extends BaseMapper<CiInstance> {

    @Results(id = "ciInstanceMap", value = {
        @Result(column = "id",         property = "id"),
        @Result(column = "tenant_id",  property = "tenantId"),
        @Result(column = "model_id",   property = "modelId"),
        @Result(column = "name",       property = "name"),
        @Result(column = "attrs",      property = "attrs",
                javaType = Map.class,  typeHandler = JacksonTypeHandler.class),
        @Result(column = "is_deleted", property = "isDeleted"),
        @Result(column = "deleted_at", property = "deletedAt"),
        @Result(column = "deleted_by", property = "deletedBy"),
        @Result(column = "created_at", property = "createdAt"),
        @Result(column = "updated_at", property = "updatedAt"),
        @Result(column = "created_by", property = "createdBy"),
        @Result(column = "updated_by", property = "updatedBy")
    })
    @Select("SELECT * FROM ci_instance WHERE tenant_id = #{tenantId} AND model_id = #{modelId} AND is_deleted = FALSE ORDER BY created_at DESC")
    Page<CiInstance> findByModel(Page<CiInstance> page,
                                  @Param("tenantId") String tenantId,
                                  @Param("modelId") String modelId);

    @Select("SELECT COUNT(*) FROM ci_instance WHERE tenant_id = #{tenantId} AND model_id = #{modelId} AND is_deleted = FALSE AND attrs ->> #{fieldKey} = #{value} AND id != #{excludeId}")
    int countByFieldValue(@Param("tenantId") String tenantId,
                           @Param("modelId") String modelId,
                           @Param("fieldKey") String fieldKey,
                           @Param("value") String value,
                           @Param("excludeId") long excludeId);
}
