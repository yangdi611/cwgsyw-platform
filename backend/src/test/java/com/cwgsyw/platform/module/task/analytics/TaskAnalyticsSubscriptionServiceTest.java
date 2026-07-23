package com.cwgsyw.platform.module.task.analytics;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.UserGroupMembershipMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsDashboardVO;
import com.cwgsyw.platform.module.task.analytics.service.TaskAnalyticsDashboardService;
import com.cwgsyw.platform.module.task.analytics.subscription.TaskAnalyticsSubscriptionDispatcher;
import com.cwgsyw.platform.module.task.analytics.subscription.TaskAnalyticsSubscriptionService;
import com.cwgsyw.platform.module.task.analytics.subscription.dto.SubscriptionRequest;
import com.cwgsyw.platform.module.task.analytics.subscription.entity.TaskAnalyticsSubscription;
import com.cwgsyw.platform.module.task.analytics.subscription.mapper.TaskAnalyticsSubscriptionMapper;
import com.cwgsyw.platform.module.task.runtime.service.TaskVisibilityService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
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
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskAnalyticsSubscriptionServiceTest {
    @Mock TaskAnalyticsSubscriptionMapper subscriptionMapper;
    @Mock TaskAnalyticsDashboardService dashboardService;
    @Mock UserMapper userMapper;
    @Mock GroupMapper groupMapper;
    @Mock UserGroupMembershipMapper membershipMapper;
    @Mock TaskVisibilityService visibilityService;
    @Mock TaskAnalyticsSubscriptionDispatcher dispatcher;

    private TaskAnalyticsSubscriptionService service;
    private SecurityUser groupViewer;

    @BeforeEach
    void setUp() {
        service = new TaskAnalyticsSubscriptionService(subscriptionMapper, dashboardService, userMapper,
            groupMapper, membershipMapper, visibilityService, dispatcher);
        groupViewer = new SecurityUser(7L, "viewer", "", "tenant-a", 5L, "group",
            Set.of("task_analytics:update"));
    }

    @Test
    void groupViewerCannotManageAnotherUsersSharedDashboardSubscription() {
        when(dashboardService.get(groupViewer, 19L)).thenReturn(dashboard(false));

        assertThatThrownBy(() -> service.create(groupViewer, 19L, request()))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("ANALYTICS_SUBSCRIPTION_MANAGE_DENIED"));
        verify(subscriptionMapper, never()).insert(any(TaskAnalyticsSubscription.class));
    }

    @Test
    void ownerCanCreateSubscriptionWithValidatedNormalizedRecipients() {
        SecurityUser owner = new SecurityUser(8L, "owner", "", "tenant-a", 5L, "group",
            Set.of("task_analytics:update"));
        when(dashboardService.get(owner, 19L)).thenReturn(dashboard(true));
        when(visibilityService.groupIds(owner)).thenReturn(Set.of(5L));
        when(visibilityService.isTenantScope(owner)).thenReturn(false);
        when(userMapper.selectOne(any())).thenReturn(user(11L, 5L, "ops@example.test"));
        when(membershipMapper.findEffectiveActiveBusinessGroupIds("tenant-a", 11L)).thenReturn(List.of(5L));

        service.create(owner, 19L, new SubscriptionRequest("日报", "user",
            Map.of("ids", List.of("11", 11L)), Map.of("type", "daily", "time", "09:00"), "notification"));

        ArgumentCaptor<TaskAnalyticsSubscription> captor = ArgumentCaptor.forClass(TaskAnalyticsSubscription.class);
        verify(subscriptionMapper).insert(captor.capture());
        assertThat(captor.getValue().getRecipientConfig()).containsEntry("ids", List.of(11L));
        assertThat(captor.getValue().getNextSendAt()).isNotNull();
    }

    @Test
    void rejectsRecipientOutsideManageableGroup() {
        when(dashboardService.get(groupViewer, 19L)).thenReturn(dashboard(true));
        when(visibilityService.groupIds(groupViewer)).thenReturn(Set.of(5L));
        when(visibilityService.isTenantScope(groupViewer)).thenReturn(false);
        when(groupMapper.selectOne(any())).thenReturn(group(9L));

        SubscriptionRequest request = new SubscriptionRequest("跨组日报", "group",
            Map.of("ids", List.of(9L)), Map.of("type", "weekly", "dayOfWeek", 1, "time", "09:00"),
            "notification");

        assertThatThrownBy(() -> service.create(groupViewer, 19L, request))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("ANALYTICS_SUBSCRIPTION_GROUP_DENIED"));
        verify(subscriptionMapper, never()).insert(any(TaskAnalyticsSubscription.class));
    }

    @Test
    void rejectsInvalidScheduleAndMissingEmailBeforePersisting() {
        when(dashboardService.get(groupViewer, 19L)).thenReturn(dashboard(true));

        assertThatThrownBy(() -> service.create(groupViewer, 19L, new SubscriptionRequest("月报", "user",
            Map.of("ids", List.of(11L)), Map.of("type", "monthly", "dayOfMonth", 31), "notification")))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("ANALYTICS_SUBSCRIPTION_SCHEDULE_INVALID"));

        when(visibilityService.groupIds(groupViewer)).thenReturn(Set.of(5L));
        when(visibilityService.isTenantScope(groupViewer)).thenReturn(false);
        when(userMapper.selectOne(any())).thenReturn(user(11L, 5L, null));
        when(membershipMapper.findEffectiveActiveBusinessGroupIds("tenant-a", 11L)).thenReturn(List.of(5L));
        assertThatThrownBy(() -> service.create(groupViewer, 19L, new SubscriptionRequest("邮件日报", "user",
            Map.of("ids", List.of(11L)), Map.of("type", "daily", "time", "09:00"), "email")))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("ANALYTICS_SUBSCRIPTION_EMAIL_EMPTY"));
        verify(subscriptionMapper, never()).insert(any(TaskAnalyticsSubscription.class));
    }

    @Test
    void schedulerIsolatesOneSubscriptionFailureAndContinues() {
        TaskAnalyticsSubscription first = due(1L);
        TaskAnalyticsSubscription second = due(2L);
        when(subscriptionMapper.selectList(any())).thenReturn(List.of(first, second));
        doThrow(new IllegalStateException("queue unavailable")).when(dispatcher)
            .dispatchDue(eq("tenant-a"), eq(1L), any(), any());

        service.tick();

        verify(dispatcher, times(2)).dispatchDue(eq("tenant-a"), any(), any(), any());
        verify(dispatcher).dispatchDue(eq("tenant-a"), eq(2L), any(), any());
    }

    private SubscriptionRequest request() {
        return new SubscriptionRequest("日报", "user", Map.of("ids", List.of(11L)),
            Map.of("type", "daily", "time", "09:00"), "notification");
    }

    private AnalyticsDashboardVO dashboard(boolean canManage) {
        return new AnalyticsDashboardVO(19L, "ops", "运维", null, "group", 8L, 5L,
            Map.of(), List.of(), canManage, null, null);
    }

    private User user(Long id, Long groupId, String email) {
        User user = new User();
        user.setId(id); user.setTenantId("tenant-a"); user.setGroupId(groupId); user.setUsername("u" + id);
        user.setEmail(email); user.setStatus(1); user.setIsDeleted(false);
        return user;
    }

    private Group group(Long id) {
        Group group = new Group();
        group.setId(id); group.setTenantId("tenant-a"); group.setGroupType("business"); group.setIsDeleted(false);
        return group;
    }

    private TaskAnalyticsSubscription due(Long id) {
        TaskAnalyticsSubscription value = new TaskAnalyticsSubscription();
        value.setId(id); value.setTenantId("tenant-a"); value.setStatus("active");
        value.setNextSendAt(LocalDateTime.now().minusMinutes(1));
        value.setScheduleConfig(Map.of("type", "daily", "time", "09:00"));
        return value;
    }
}
