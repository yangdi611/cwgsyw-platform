package com.cwgsyw.platform.module.cmdb.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationDef;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CiAssociationDefMapper extends BaseMapper<CiAssociationDef> {

    /**
     * 按业务主键 def_id 查询关联定义（AD-3）。带租户隔离与软删过滤。
     */
    @Select("SELECT * FROM ci_association_def " +
            "WHERE def_id = #{defId} AND tenant_id = #{tenantId} AND NOT is_deleted")
    CiAssociationDef findByDefId(@Param("defId") String defId, @Param("tenantId") String tenantId);
}
