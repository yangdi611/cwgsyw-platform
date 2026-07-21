package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDoc;
import org.apache.ibatis.annotations.*;

import java.util.Map;

@Mapper
public interface ChangeDocMapper extends BaseMapper<ChangeDoc> {
    @Select("SELECT * FROM change_doc WHERE id = #{id} AND tenant_id = #{tenantId} AND is_deleted = FALSE FOR UPDATE")
    @Results({
            @Result(column = "fields_data", property = "fieldsData",
                    javaType = Map.class, typeHandler = JacksonTypeHandler.class)
    })
    ChangeDoc selectForUpdate(@Param("tenantId") String tenantId, @Param("id") Long id);

    @Select("SELECT COALESCE(MAX(CAST(NULLIF(SPLIT_PART(change_no, '-', 3), '') AS INTEGER)), 0) FROM change_doc WHERE tenant_id = #{tenantId} AND change_no LIKE #{prefix} || '%' AND SPLIT_PART(change_no, '-', 3) ~ '^[0-9]+$'")
    int maxSeqForPrefix(@Param("tenantId") String tenantId, @Param("prefix") String prefix);

    @Select("SELECT COUNT(*) FROM change_doc WHERE tenant_id = #{tenantId} AND is_deleted = FALSE AND (template_id = #{templateId} OR application_template_id = #{templateId} OR plan_template_id = #{templateId})")
    int countActiveReferences(@Param("tenantId") String tenantId, @Param("templateId") Long templateId);
}
