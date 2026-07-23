package com.cwgsyw.platform.module.task.notification;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface TaskNotificationDeliveryMapper extends BaseMapper<TaskNotificationDelivery> {
    @Insert("""
        INSERT INTO task_notification_delivery
          (tenant_id, task_id, submission_id, approval_round_id, event_type, recipient_id,
           channel, dedupe_key, subscription_id, batch_key, payload, status, attempt_count, next_attempt_at)
        VALUES
          (#{tenantId}, #{taskId}, #{submissionId}, #{approvalRoundId}, #{eventType}, #{recipientId},
           #{channel}, #{dedupeKey}, #{subscriptionId}, #{batchKey}, CAST(#{payloadJson} AS JSONB),
           'pending', 0, #{nextAttemptAt})
        ON CONFLICT (tenant_id, dedupe_key) DO NOTHING
        """)
    int enqueue(@Param("tenantId") String tenantId,
                @Param("taskId") Long taskId,
                @Param("submissionId") Long submissionId,
                @Param("approvalRoundId") Long approvalRoundId,
                @Param("eventType") String eventType,
                @Param("recipientId") Long recipientId,
                @Param("channel") String channel,
                @Param("dedupeKey") String dedupeKey,
                @Param("subscriptionId") Long subscriptionId,
                @Param("batchKey") String batchKey,
                @Param("payloadJson") String payloadJson,
                @Param("nextAttemptAt") LocalDateTime nextAttemptAt);

    @Select("""
        SELECT * FROM task_notification_delivery
         WHERE status IN ('pending','failed') AND next_attempt_at <= #{now}
         ORDER BY next_attempt_at, id
         LIMIT #{limit}
        """)
    List<TaskNotificationDelivery> findDue(@Param("now") LocalDateTime now, @Param("limit") int limit);

    @Update("""
        UPDATE task_notification_delivery
           SET next_attempt_at = #{leaseUntil}, updated_at = #{now}
         WHERE tenant_id = #{tenantId} AND id = #{id}
           AND status IN ('pending','failed') AND next_attempt_at <= #{now}
        """)
    int claim(@Param("tenantId") String tenantId, @Param("id") Long id,
              @Param("now") LocalDateTime now, @Param("leaseUntil") LocalDateTime leaseUntil);

    @Update("""
        UPDATE task_analytics_subscription subscription
           SET last_sent_at = #{sentAt}, updated_at = #{sentAt}
         WHERE subscription.id = #{subscriptionId}
           AND subscription.tenant_id = #{tenantId}
           AND NOT EXISTS (
               SELECT 1
                 FROM task_notification_delivery delivery
                WHERE delivery.tenant_id = #{tenantId}
                  AND delivery.subscription_id = #{subscriptionId}
                  AND delivery.batch_key = #{batchKey}
                  AND delivery.status <> 'sent'
           )
        """)
    int markSubscriptionDeliveredIfComplete(@Param("tenantId") String tenantId,
                                            @Param("subscriptionId") Long subscriptionId,
                                            @Param("batchKey") String batchKey,
                                            @Param("sentAt") LocalDateTime sentAt);
}
