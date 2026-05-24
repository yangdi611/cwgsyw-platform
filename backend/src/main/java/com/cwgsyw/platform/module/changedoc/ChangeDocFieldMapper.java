package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocField;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface ChangeDocFieldMapper extends BaseMapper<ChangeDocField> {
    @Select("SELECT * FROM change_doc_field WHERE template_id = #{templateId} ORDER BY sort_order")
    List<ChangeDocField> findByTemplate(@Param("templateId") Long templateId);
}
