package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDoc;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ChangeDocMapper extends BaseMapper<ChangeDoc> {
    @Select("SELECT COALESCE(MAX(CAST(SPLIT_PART(change_no, '-', 4) AS INTEGER)), 0) FROM change_doc WHERE tenant_id = #{tenantId} AND change_no LIKE #{prefix} || '%'")
    int maxSeqForPrefix(@Param("tenantId") String tenantId, @Param("prefix") String prefix);
}
