package com.cwgsyw.platform.module.task.runtime.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cwgsyw.platform.module.task.runtime.entity.TaskDraft;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.util.Map;

@Mapper
public interface TaskDraftMapper extends BaseMapper<TaskDraft> {
    @Results(id = "taskDraftLatestMap", value = {
        @Result(column = "form_data", property = "formData", javaType = Map.class, typeHandler = JacksonTypeHandler.class)
    })
    @Select("SELECT * FROM task_draft WHERE tenant_id = #{tenantId} AND task_id = #{taskId} ORDER BY revision DESC LIMIT 1")
    TaskDraft findLatest(@Param("tenantId") String tenantId, @Param("taskId") Long taskId);
}
