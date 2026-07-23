package com.cwgsyw.platform.module.task.runtime.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 任务实例 Mapper
 */
@Mapper
public interface TaskInstanceMapper extends BaseMapper<TaskInstance> {
    @Select("SELECT * FROM task_instance WHERE id = #{id} AND tenant_id = #{tenantId} AND is_deleted = FALSE FOR UPDATE")
    TaskInstance lockById(@Param("tenantId") String tenantId, @Param("id") Long id);
}
