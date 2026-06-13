package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationKind;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface CiAssociationKindMapper extends BaseMapper<CiAssociationKind> {
    @Select("SELECT * FROM ci_association_kind WHERE tenant_id = #{tenantId} AND is_deleted = FALSE ORDER BY id")
    List<CiAssociationKind> findByTenant(@Param("tenantId") String tenantId);
}
