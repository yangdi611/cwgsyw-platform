package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cwgsyw.platform.module.cmdb.entity.CiInstanceRel;
import org.apache.ibatis.annotations.*;
import java.util.List;
import java.util.Map;

@Mapper
public interface CiInstanceRelMapper extends BaseMapper<CiInstanceRel> {

    @Results(id = "ciRelMap", value = {
        @Result(column = "id",         property = "id"),
        @Result(column = "tenant_id",  property = "tenantId"),
        @Result(column = "def_id",     property = "defId"),
        @Result(column = "src_id",     property = "srcId"),
        @Result(column = "dst_id",     property = "dstId"),
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
    @Select("SELECT * FROM ci_instance_rel WHERE tenant_id = #{tenantId} AND (src_id = #{instanceId} OR dst_id = #{instanceId}) AND is_deleted = FALSE ORDER BY created_at DESC")
    List<CiInstanceRel> findByInstance(@Param("tenantId") String tenantId,
                                        @Param("instanceId") Long instanceId);

    @Select("SELECT COUNT(*) FROM ci_instance_rel WHERE tenant_id = #{tenantId} AND def_id = #{defId} AND src_id = #{srcId} AND is_deleted = FALSE AND id != #{excludeId}")
    int countBySrcAndDef(@Param("tenantId") String tenantId,
                          @Param("defId") String defId,
                          @Param("srcId") Long srcId,
                          @Param("excludeId") long excludeId);

    @Select("SELECT COUNT(*) FROM ci_instance_rel WHERE tenant_id = #{tenantId} AND def_id = #{defId} AND dst_id = #{dstId} AND is_deleted = FALSE AND id != #{excludeId}")
    int countByDstAndDef(@Param("tenantId") String tenantId,
                          @Param("defId") String defId,
                          @Param("dstId") Long dstId,
                          @Param("excludeId") long excludeId);
}
