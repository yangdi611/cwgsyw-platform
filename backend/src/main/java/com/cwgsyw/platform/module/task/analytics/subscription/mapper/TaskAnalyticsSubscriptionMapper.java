package com.cwgsyw.platform.module.task.analytics.subscription.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.task.analytics.subscription.entity.TaskAnalyticsSubscription;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

@Mapper
public interface TaskAnalyticsSubscriptionMapper extends BaseMapper<TaskAnalyticsSubscription> {
    @Update("""
        UPDATE task_analytics_subscription
           SET next_send_at = #{nextSendAt}, updated_at = #{now}
         WHERE id = #{id} AND tenant_id = #{tenantId} AND status = 'active'
           AND (next_send_at IS NULL OR next_send_at <= #{now})
        """)
    int claimDue(@Param("tenantId") String tenantId, @Param("id") Long id,
                 @Param("now") LocalDateTime now, @Param("nextSendAt") LocalDateTime nextSendAt);
}
