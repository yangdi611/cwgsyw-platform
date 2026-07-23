package com.cwgsyw.platform.module.task.runtime.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.task.runtime.entity.TaskSubmission;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 任务提交 Mapper
 */
@Mapper
public interface TaskSubmissionMapper extends BaseMapper<TaskSubmission> {
    @Select("SELECT * FROM task_submission WHERE tenant_id = #{tenantId} AND task_id = #{taskId} AND idempotency_key = #{idempotencyKey}")
    TaskSubmission findByIdempotencyKey(@Param("tenantId") String tenantId,
                                        @Param("taskId") Long taskId,
                                        @Param("idempotencyKey") String idempotencyKey);
}
