package com.cwgsyw.platform.module.task.analytics.subscription;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsDashboardVO;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsQueryRequest;
import com.cwgsyw.platform.module.task.analytics.entity.TaskAnalyticsDashboard;
import com.cwgsyw.platform.module.task.analytics.mapper.TaskAnalyticsDashboardMapper;
import com.cwgsyw.platform.module.task.analytics.service.TaskAnalyticsDashboardService;
import com.cwgsyw.platform.module.task.analytics.service.TaskAnalyticsQueryService;
import com.cwgsyw.platform.module.task.analytics.subscription.entity.TaskAnalyticsSubscription;
import com.cwgsyw.platform.module.task.analytics.subscription.mapper.TaskAnalyticsSubscriptionMapper;
import com.cwgsyw.platform.module.task.notification.TaskNotificationOutbox;
import com.cwgsyw.platform.module.org.UserGroupMembershipMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TaskAnalyticsSubscriptionDispatcher {
    private final TaskAnalyticsSubscriptionMapper subscriptionMapper;
    private final TaskAnalyticsDashboardMapper dashboardMapper;
    private final TaskAnalyticsDashboardService dashboardService;
    private final TaskAnalyticsQueryService queryService;
    private final UserMapper userMapper;
    private final UserGroupMembershipMapper membershipMapper;
    private final RbacService rbacService;
    private final TaskNotificationOutbox notificationOutbox;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void dispatchDue(String tenantId, Long subscriptionId, LocalDateTime dueAt,
                            LocalDateTime nextSendAt) {
        if (subscriptionMapper.claimDue(tenantId, subscriptionId, dueAt, nextSendAt) != 1) return;
        TaskAnalyticsSubscription subscription = requireActive(tenantId, subscriptionId);
        enqueue(subscription, "scheduled:" + dueAt, dueAt);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void dispatchTest(SecurityUser operator, Long subscriptionId, LocalDateTime now) {
        TaskAnalyticsSubscription subscription = requireActive(operator.getTenantId(), subscriptionId);
        enqueue(subscription, "test:" + operator.getUserId() + ':' + now, now);
    }

    private void enqueue(TaskAnalyticsSubscription subscription, String batchKey, LocalDateTime now) {
        TaskAnalyticsDashboard dashboard = dashboardMapper.selectOne(
            new LambdaQueryWrapper<TaskAnalyticsDashboard>()
                .eq(TaskAnalyticsDashboard::getTenantId, subscription.getTenantId())
                .eq(TaskAnalyticsDashboard::getId, subscription.getDashboardId())
                .eq(TaskAnalyticsDashboard::getIsDeleted, false));
        if (dashboard == null) {
            throw new BusinessException(404, "ANALYTICS_DASHBOARD_NOT_FOUND", "统计看板不存在");
        }

        int queued = 0;
        for (Long recipientId : recipientIds(subscription)) {
            User recipient = activeUser(subscription.getTenantId(), recipientId);
            if (recipient == null) continue;
            SecurityUser viewer = viewer(recipient);
            if (!viewer.getPermissions().contains("task_analytics:read")) continue;

            try {
                AnalyticsDashboardVO visible = dashboardService.get(viewer, subscription.getDashboardId());
                int visibleWidgets = countVisibleWidgets(viewer, visible);
                if ("email".equals(subscription.getChannel())
                        && (recipient.getEmail() == null || recipient.getEmail().isBlank())) {
                    continue;
                }
                Map<String, Object> payload = Map.of(
                    "title", "任务统计订阅：" + dashboard.getName(),
                    "content", "看板已按你的权限生成，当前可见组件 " + visibleWidgets + " 个。",
                    "refType", "task_analytics_dashboard",
                    "refId", dashboard.getId(),
                    "email", recipient.getEmail() == null ? "" : recipient.getEmail());
                String dedupeKey = "analytics-subscription:" + subscription.getId() + ':' + batchKey + ':' + recipientId;
                notificationOutbox.enqueueSubscription(subscription.getTenantId(), subscription.getId(), batchKey,
                    recipientId, subscription.getChannel(), dedupeKey, payload, now);
                queued++;
            } catch (BusinessException exception) {
                if (exception.getHttpStatus() == 403 || exception.getHttpStatus() == 404) continue;
                throw exception;
            }
        }
        if (queued == 0) {
            throw BusinessException.badRequest("ANALYTICS_SUBSCRIPTION_NO_DELIVERABLE_RECIPIENT",
                "订阅没有具备看板读取权限和有效发送渠道的接收人");
        }
    }

    private int countVisibleWidgets(SecurityUser viewer, AnalyticsDashboardVO dashboard) {
        int visibleWidgets = 0;
        for (var widget : dashboard.widgets()) {
            Object query = widget.dataSourceConfig().get("query");
            if (query == null) continue;
            queryService.query(viewer, objectMapper.convertValue(query, AnalyticsQueryRequest.class));
            visibleWidgets++;
        }
        return visibleWidgets;
    }

    private List<Long> recipientIds(TaskAnalyticsSubscription subscription) {
        List<Long> configured = configuredIds(subscription.getRecipientConfig());
        if (!"group".equals(subscription.getRecipientType())) return configured;
        Set<Long> expanded = new LinkedHashSet<>();
        configured.forEach(groupId -> expanded.addAll(
            membershipMapper.findUserIdsByGroup(subscription.getTenantId(), groupId)));
        return new ArrayList<>(expanded);
    }

    private List<Long> configuredIds(Map<String, Object> config) {
        Object value = config == null ? null : config.get("ids");
        if (!(value instanceof List<?> ids)) return List.of();
        Set<Long> result = new LinkedHashSet<>();
        for (Object id : ids) {
            try {
                result.add(Long.valueOf(String.valueOf(id)));
            } catch (NumberFormatException ignored) {
                // Configuration validation prevents this for newly saved subscriptions.
            }
        }
        return new ArrayList<>(result);
    }

    private TaskAnalyticsSubscription requireActive(String tenantId, Long id) {
        TaskAnalyticsSubscription value = subscriptionMapper.selectOne(
            new LambdaQueryWrapper<TaskAnalyticsSubscription>()
                .eq(TaskAnalyticsSubscription::getTenantId, tenantId)
                .eq(TaskAnalyticsSubscription::getId, id)
                .eq(TaskAnalyticsSubscription::getStatus, "active"));
        if (value == null) {
            throw new BusinessException(404, "ANALYTICS_SUBSCRIPTION_NOT_FOUND", "有效订阅不存在");
        }
        return value;
    }

    private User activeUser(String tenantId, Long userId) {
        return userMapper.selectOne(new LambdaQueryWrapper<User>()
            .eq(User::getTenantId, tenantId).eq(User::getId, userId)
            .eq(User::getIsDeleted, false).eq(User::getStatus, 1));
    }

    private SecurityUser viewer(User user) {
        return new SecurityUser(user.getId(), user.getUsername(), user.getPassword(), user.getTenantId(),
            user.getGroupId(), rbacService.getHighestScope(user.getId()), rbacService.getUserPermissions(user.getId()));
    }
}
