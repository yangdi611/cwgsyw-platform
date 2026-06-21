package com.cwgsyw.platform.module.cmdb.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CiAttributeMapper extends BaseMapper<CiAttribute> {

    @Results({
            @Result(column = "option", property = "enumOptions")
    })
    @Select("SELECT * FROM ci_attribute WHERE model_id = #{modelId} AND tenant_id = #{tenantId} AND NOT is_deleted ORDER BY sort_order")
    List<CiAttribute> listByModel(@Param("modelId") String modelId, @Param("tenantId") String tenantId);
}
