package com.cwgsyw.platform.module.task.runtime.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.task.runtime.entity.TaskDraft;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TaskDraftMapper extends BaseMapper<TaskDraft> {
    @Select("SELECT * FROM task_draft WHERE tenant_id = #{tenantId} AND task_id = #{taskId} ORDER BY revision DESC LIMIT 1")
    TaskDraft findLatest(@Param("tenantId") String tenantId, @Param("taskId") Long taskId);
}
