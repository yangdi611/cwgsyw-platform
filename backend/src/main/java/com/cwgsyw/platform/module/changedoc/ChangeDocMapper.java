package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDoc;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ChangeDocMapper extends BaseMapper<ChangeDoc> {
    @Select("SELECT COALESCE(MAX(CAST(NULLIF(SPLIT_PART(change_no, '-', 3), '') AS INTEGER)), 0) FROM change_doc WHERE tenant_id = #{tenantId} AND change_no LIKE #{prefix} || '%' AND SPLIT_PART(change_no, '-', 3) ~ '^[0-9]+$'")
    int maxSeqForPrefix(@Param("tenantId") String tenantId, @Param("prefix") String prefix);
}
