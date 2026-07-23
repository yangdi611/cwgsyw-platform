package com.cwgsyw.platform.module.task.metric.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.task.metric.entity.TaskMetricFact;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface TaskMetricFactMapper extends BaseMapper<TaskMetricFact> {
    @Update("UPDATE task_metric_fact SET effective=FALSE, invalidated_at=#{now} " +
        "WHERE tenant_id=#{tenantId} AND task_id=#{taskId} AND effective=TRUE")
    int deactivateTaskFacts(@Param("tenantId") String tenantId, @Param("taskId") Long taskId,
                            @Param("now") LocalDateTime now);

    @Select("""
        UPDATE task_metric_fact
           SET effective = TRUE, invalidated_at = NULL
         WHERE tenant_id = #{tenantId}
           AND submission_id = #{submissionId}
           AND effective = FALSE
        RETURNING *
        """)
    List<TaskMetricFact> activateSubmissionFacts(@Param("tenantId") String tenantId,
                                                 @Param("submissionId") Long submissionId,
                                                 @Param("now") LocalDateTime now);
}
