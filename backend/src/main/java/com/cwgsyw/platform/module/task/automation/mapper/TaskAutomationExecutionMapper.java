package com.cwgsyw.platform.module.task.automation.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.task.automation.entity.TaskAutomationExecution;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

@Mapper
public interface TaskAutomationExecutionMapper extends BaseMapper<TaskAutomationExecution> {
    @Insert("""
        INSERT INTO task_automation_execution
          (tenant_id, rule_id, source_type, source_id, event_type, source_task_id,
           source_submission_id, source_occurred_at, source_attributes, dedupe_key,
           status, attempt_count, next_attempt_at, created_at, updated_at)
        VALUES
          (#{tenantId}, #{ruleId}, #{sourceType}, #{sourceId}, #{eventType}, #{sourceTaskId},
           #{sourceSubmissionId}, #{sourceOccurredAt}, CAST(#{sourceAttributesJson} AS JSONB), #{dedupeKey},
           'pending', 0, #{now}, #{now}, #{now})
        ON CONFLICT (tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
        """)
    int claim(@Param("tenantId") String tenantId, @Param("ruleId") Long ruleId,
              @Param("sourceType") String sourceType, @Param("sourceId") Long sourceId,
              @Param("eventType") String eventType, @Param("sourceTaskId") Long sourceTaskId,
              @Param("sourceSubmissionId") Long sourceSubmissionId,
              @Param("sourceOccurredAt") LocalDateTime sourceOccurredAt,
              @Param("sourceAttributesJson") String sourceAttributesJson,
              @Param("dedupeKey") String dedupeKey, @Param("now") LocalDateTime now);

    @Update("""
        UPDATE task_automation_execution
        SET status = 'pending', next_attempt_at = #{now}, updated_at = #{now}
        WHERE tenant_id = #{tenantId} AND id = #{executionId} AND status IN ('failed', 'dead')
        """)
    int requeue(@Param("tenantId") String tenantId, @Param("executionId") Long executionId,
                @Param("now") LocalDateTime now);

    @Update("""
        UPDATE task_automation_execution
        SET next_attempt_at = #{leaseUntil}, updated_at = #{now}
        WHERE tenant_id = #{tenantId} AND id = #{executionId} AND status = 'pending'
          AND next_attempt_at <= #{now}
        """)
    int claimPending(@Param("tenantId") String tenantId, @Param("executionId") Long executionId,
                     @Param("now") LocalDateTime now, @Param("leaseUntil") LocalDateTime leaseUntil);
}
