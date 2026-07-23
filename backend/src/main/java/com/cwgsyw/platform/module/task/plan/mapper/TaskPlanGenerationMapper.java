package com.cwgsyw.platform.module.task.plan.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.task.plan.entity.TaskPlanGeneration;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

@Mapper
public interface TaskPlanGenerationMapper extends BaseMapper<TaskPlanGeneration> {
    @Insert("""
        INSERT INTO task_plan_generation
            (tenant_id, plan_id, occurrence_key, occurrence_at, subject_type, subject_id, status, attempt_count, last_attempt_at)
        VALUES
            (#{tenantId}, #{planId}, #{occurrenceKey}, #{occurrenceAt}, #{subjectType}, #{subjectId}, 'pending', 1, #{now})
        ON CONFLICT (tenant_id, plan_id, occurrence_key) DO NOTHING
        """)
    int claim(@Param("tenantId") String tenantId,
              @Param("planId") Long planId,
              @Param("occurrenceKey") String occurrenceKey,
              @Param("occurrenceAt") LocalDateTime occurrenceAt,
              @Param("subjectType") String subjectType,
              @Param("subjectId") Long subjectId,
              @Param("now") LocalDateTime now);

    @Update("""
        UPDATE task_plan_generation
        SET status = 'pending', attempt_count = attempt_count + 1, last_attempt_at = #{now},
            error_code = NULL, error_message = NULL
        WHERE tenant_id = #{tenantId} AND plan_id = #{planId} AND occurrence_key = #{occurrenceKey}
          AND (status = 'failed' OR (status = 'pending' AND last_attempt_at < #{staleBefore}))
        """)
    int reclaim(@Param("tenantId") String tenantId,
                @Param("planId") Long planId,
                @Param("occurrenceKey") String occurrenceKey,
                @Param("now") LocalDateTime now,
                @Param("staleBefore") LocalDateTime staleBefore);

    @Select("SELECT * FROM task_plan_generation WHERE tenant_id = #{tenantId} AND plan_id = #{planId} AND occurrence_key = #{occurrenceKey}")
    TaskPlanGeneration findByOccurrenceKey(@Param("tenantId") String tenantId,
                                           @Param("planId") Long planId,
                                           @Param("occurrenceKey") String occurrenceKey);
}
