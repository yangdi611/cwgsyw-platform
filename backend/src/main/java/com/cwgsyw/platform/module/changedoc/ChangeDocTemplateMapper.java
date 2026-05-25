package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocTemplate;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface ChangeDocTemplateMapper extends BaseMapper<ChangeDocTemplate> {
    @Select("SELECT * FROM change_doc_template WHERE tenant_id = #{tenantId} AND is_deleted = FALSE ORDER BY is_active DESC, created_at DESC")
    List<ChangeDocTemplate> findByTenant(@Param("tenantId") String tenantId);
}
