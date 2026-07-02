package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocField;
import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface ChangeDocFieldMapper extends BaseMapper<ChangeDocField> {
    /**
     * 不能用 @Select 自定义 SQL：会绕过 autoResultMap，导致 config(JSONB) 读取为 null。
     * 见 CLAUDE.md「JSONB 查询（@Select 陷阱）」。
     */
    default List<ChangeDocField> findByTemplate(Long templateId) {
        return selectList(new LambdaQueryWrapper<ChangeDocField>()
                .eq(ChangeDocField::getTemplateId, templateId)
                .orderByAsc(ChangeDocField::getSortOrder));
    }
}
