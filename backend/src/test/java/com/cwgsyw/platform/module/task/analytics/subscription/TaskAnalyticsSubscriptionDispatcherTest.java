package com.cwgsyw.platform.module.task.analytics.subscription;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.org.UserGroupMembershipMapper;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsDashboardVO;
import com.cwgsyw.platform.module.task.analytics.entity.TaskAnalyticsDashboard;
import com.cwgsyw.platform.module.task.analytics.mapper.TaskAnalyticsDashboardMapper;
import com.cwgsyw.platform.module.task.analytics.service.TaskAnalyticsDashboardService;
import com.cwgsyw.platform.module.task.analytics.service.TaskAnalyticsQueryService;
import com.cwgsyw.platform.module.task.analytics.subscription.entity.TaskAnalyticsSubscription;
import com.cwgsyw.platform.module.task.analytics.subscription.mapper.TaskAnalyticsSubscriptionMapper;
import com.cwgsyw.platform.module.task.notification.TaskNotificationOutbox;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskAnalyticsSubscriptionDispatcherTest {
    @Mock TaskAnalyticsSubscriptionMapper subscriptionMapper;
    @Mock TaskAnalyticsDashboardMapper dashboardMapper;
    @Mock TaskAnalyticsDashboardService dashboardService;
    @Mock TaskAnalyticsQueryService queryService;
    @Mock UserMapper userMapper;
    @Mock UserGroupMembershipMapper membershipMapper;
    @Mock RbacService rbacService;
    @Mock TaskNotificationOutbox outbox;

    private TaskAnalyticsSubscriptionDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        dispatcher = new TaskAnalyticsSubscriptionDispatcher(subscriptionMapper, dashboardMapper, dashboardService,
            queryService, userMapper, membershipMapper, rbacService, outbox, new ObjectMapper());
    }

    @Test
    void scheduledDispatchClaimsAndQueuesRecipientSpecificPayload() {
        LocalDateTime now = LocalDateTime.of(2026, 7, 23, 9, 0);
        when(subscriptionMapper.claimDue("tenant-a", 3L, now, now.plusDays(1))).thenReturn(1);
        when(subscriptionMapper.selectOne(any())).thenReturn(subscription("user", List.of(11L), "notification"));
        when(dashboardMapper.selectOne(any())).thenReturn(dashboard());
        when(userMapper.selectOne(any())).thenReturn(user(11L, "ops@example.test"));
        when(rbacService.getHighestScope(11L)).thenReturn("group");
        when(rbacService.getUserPermissions(11L)).thenReturn(Set.of("task_analytics:read"));
        when(dashboardService.get(any(SecurityUser.class), eq(19L))).thenReturn(visibleDashboard());

        dispatcher.dispatchDue("tenant-a", 3L, now, now.plusDays(1));

        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
        verify(outbox).enqueueSubscription(eq("tenant-a"), eq(3L), eq("scheduled:" + now), eq(11L),
            eq("notification"), eq("analytics-subscription:3:scheduled:" + now + ":11"),
            payload.capture(), eq(now));
        assertThat(payload.getValue()).containsEntry("refType", "task_analytics_dashboard")
            .containsEntry("refId", 19L);
    }

    @Test
    void groupRecipientsAreExpandedAndDeduplicated() {
        LocalDateTime now = LocalDateTime.of(2026, 7, 23, 9, 0);
        when(subscriptionMapper.claimDue("tenant-a", 3L, now, now.plusDays(1))).thenReturn(1);
        when(subscriptionMapper.selectOne(any())).thenReturn(subscription("group", List.of(5L, 6L), "notification"));
        when(dashboardMapper.selectOne(any())).thenReturn(dashboard());
        when(membershipMapper.findUserIdsByGroup("tenant-a", 5L)).thenReturn(List.of(11L, 12L));
        when(membershipMapper.findUserIdsByGroup("tenant-a", 6L)).thenReturn(List.of(12L));
        when(userMapper.selectOne(any())).thenReturn(user(11L, "a@example.test"), user(12L, "b@example.test"));
        when(rbacService.getHighestScope(any())).thenReturn("group");
        when(rbacService.getUserPermissions(any())).thenReturn(Set.of("task_analytics:read"));
        when(dashboardService.get(any(SecurityUser.class), eq(19L))).thenReturn(visibleDashboard());

        dispatcher.dispatchDue("tenant-a", 3L, now, now.plusDays(1));

        verify(outbox).enqueueSubscription(eq("tenant-a"), eq(3L), any(), eq(11L), any(), any(), any(), eq(now));
        verify(outbox).enqueueSubscription(eq("tenant-a"), eq(3L), any(), eq(12L), any(), any(), any(), eq(now));
    }

    @Test
    void lowPermissionRecipientReceivesNothingAndBatchRollsBack() {
        LocalDateTime now = LocalDateTime.of(2026, 7, 23, 9, 0);
        when(subscriptionMapper.claimDue("tenant-a", 3L, now, now.plusDays(1))).thenReturn(1);
        when(subscriptionMapper.selectOne(any())).thenReturn(subscription("user", List.of(11L), "notification"));
        when(dashboardMapper.selectOne(any())).thenReturn(dashboard());
        when(userMapper.selectOne(any())).thenReturn(user(11L, "ops@example.test"));
        when(rbacService.getHighestScope(11L)).thenReturn("group");
        when(rbacService.getUserPermissions(11L)).thenReturn(Set.of());

        assertThatThrownBy(() -> dispatcher.dispatchDue("tenant-a", 3L, now, now.plusDays(1)))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("ANALYTICS_SUBSCRIPTION_NO_DELIVERABLE_RECIPIENT"));
        verify(outbox, never()).enqueueSubscription(any(), any(), any(), any(), any(), any(), any(), any());
        verify(dashboardService, never()).get(any(), any());
    }

    private TaskAnalyticsSubscription subscription(String recipientType, List<Long> ids, String channel) {
        TaskAnalyticsSubscription value = new TaskAnalyticsSubscription();
        value.setId(3L); value.setTenantId("tenant-a"); value.setDashboardId(19L); value.setStatus("active");
        value.setRecipientType(recipientType); value.setRecipientConfig(Map.of("ids", ids)); value.setChannel(channel);
        return value;
    }

    private TaskAnalyticsDashboard dashboard() {
        TaskAnalyticsDashboard value = new TaskAnalyticsDashboard();
        value.setId(19L); value.setTenantId("tenant-a"); value.setName("运维看板");
        return value;
    }

    private AnalyticsDashboardVO visibleDashboard() {
        return new AnalyticsDashboardVO(19L, "ops", "运维看板", null, "group", 8L, 5L,
            Map.of(), List.of(), false, null, null);
    }

    private User user(Long id, String email) {
        User value = new User();
        value.setId(id); value.setTenantId("tenant-a"); value.setUsername("u" + id); value.setGroupId(5L);
        value.setEmail(email); value.setStatus(1); value.setIsDeleted(false);
        return value;
    }
}
