package com.cwgsyw.platform.module.task.runtime.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.task.runtime.entity.TaskFieldFact;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

@Mapper
public interface TaskFieldFactMapper extends BaseMapper<TaskFieldFact> {
    @Update("UPDATE task_field_fact SET is_active = FALSE, deactivated_at = #{now} WHERE tenant_id = #{tenantId} AND task_id = #{taskId} AND is_active = TRUE")
    int deactivateTaskFacts(@Param("tenantId") String tenantId,
                            @Param("taskId") Long taskId,
                            @Param("now") LocalDateTime now);

    @Update("UPDATE task_field_fact SET is_active = TRUE, activated_at = #{now}, deactivated_at = NULL WHERE tenant_id = #{tenantId} AND submission_id = #{submissionId}")
    int activateSubmissionFacts(@Param("tenantId") String tenantId,
                                @Param("submissionId") Long submissionId,
                                @Param("now") LocalDateTime now);
}
