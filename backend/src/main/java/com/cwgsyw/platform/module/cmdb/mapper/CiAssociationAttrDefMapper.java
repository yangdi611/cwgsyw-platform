package com.cwgsyw.platform.module.cmdb.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationAttrDef;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CiAssociationAttrDefMapper extends BaseMapper<CiAssociationAttrDef> {

    @Select("SELECT * FROM ci_association_attr_def WHERE association_kind = #{kind} AND tenant_id = #{tenantId} AND NOT is_deleted ORDER BY sort_order")
    List<CiAssociationAttrDef> listByKind(@Param("kind") String associationKind, @Param("tenantId") String tenantId);
}
