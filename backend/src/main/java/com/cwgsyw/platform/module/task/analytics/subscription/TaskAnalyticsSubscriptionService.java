package com.cwgsyw.platform.module.task.analytics.subscription;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.UserGroupMembershipMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsDashboardVO;
import com.cwgsyw.platform.module.task.analytics.service.TaskAnalyticsDashboardService;
import com.cwgsyw.platform.module.task.analytics.subscription.dto.SubscriptionRequest;
import com.cwgsyw.platform.module.task.analytics.subscription.dto.SubscriptionVO;
import com.cwgsyw.platform.module.task.analytics.subscription.entity.TaskAnalyticsSubscription;
import com.cwgsyw.platform.module.task.analytics.subscription.mapper.TaskAnalyticsSubscriptionMapper;
import com.cwgsyw.platform.module.task.runtime.service.TaskVisibilityService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class TaskAnalyticsSubscriptionService {
    private static final Set<String> RECIPIENT_TYPES = Set.of("user", "group");
    private static final Set<String> CHANNELS = Set.of("notification", "email");
    private static final Set<String> SCHEDULE_TYPES = Set.of("daily", "weekly", "monthly");
    private static final int MAX_RECIPIENT_TARGETS = 100;

    private final TaskAnalyticsSubscriptionMapper subscriptionMapper;
    private final TaskAnalyticsDashboardService dashboardService;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;
    private final UserGroupMembershipMapper membershipMapper;
    private final TaskVisibilityService visibilityService;
    private final TaskAnalyticsSubscriptionDispatcher dispatcher;

    public List<SubscriptionVO> list(SecurityUser user, Long dashboardId) {
        dashboardService.get(user, dashboardId);
        return subscriptionMapper.selectList(new LambdaQueryWrapper<TaskAnalyticsSubscription>()
            .eq(TaskAnalyticsSubscription::getTenantId, user.getTenantId())
            .eq(TaskAnalyticsSubscription::getDashboardId, dashboardId)
            .ne(TaskAnalyticsSubscription::getStatus, "archived")
            .orderByDesc(TaskAnalyticsSubscription::getUpdatedAt)).stream().map(this::toVO).toList();
    }

    @Transactional(rollbackFor = Exception.class)
    public SubscriptionVO create(SecurityUser user, Long dashboardId, SubscriptionRequest request) {
        requireManageDashboard(user, dashboardId);
        List<Long> recipientIds = validate(user, request);
        TaskAnalyticsSubscription value = new TaskAnalyticsSubscription();
        value.setTenantId(user.getTenantId());
        value.setDashboardId(dashboardId);
        apply(value, request, recipientIds);
        value.setStatus("active");
        value.setCreatedAt(LocalDateTime.now());
        value.setUpdatedAt(value.getCreatedAt());
        value.setNextSendAt(nextTime(request.scheduleConfig(), value.getCreatedAt()));
        subscriptionMapper.insert(value);
        return toVO(value);
    }

    @Transactional(rollbackFor = Exception.class)
    public SubscriptionVO update(SecurityUser user, Long id, SubscriptionRequest request) {
        TaskAnalyticsSubscription value = require(user.getTenantId(), id);
        requireManageDashboard(user, value.getDashboardId());
        List<Long> recipientIds = validate(user, request);
        apply(value, request, recipientIds);
        value.setUpdatedAt(LocalDateTime.now());
        value.setNextSendAt(nextTime(request.scheduleConfig(), value.getUpdatedAt()));
        subscriptionMapper.updateById(value);
        return toVO(value);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(SecurityUser user, Long id) {
        TaskAnalyticsSubscription value = require(user.getTenantId(), id);
        requireManageDashboard(user, value.getDashboardId());
        value.setStatus("archived");
        value.setUpdatedAt(LocalDateTime.now());
        subscriptionMapper.updateById(value);
    }

    public void test(SecurityUser user, Long id) {
        TaskAnalyticsSubscription value = require(user.getTenantId(), id);
        requireManageDashboard(user, value.getDashboardId());
        dispatcher.dispatchTest(user, id, LocalDateTime.now());
    }

    public void tick() {
        LocalDateTime now = LocalDateTime.now();
        List<TaskAnalyticsSubscription> due = subscriptionMapper.selectList(
            new LambdaQueryWrapper<TaskAnalyticsSubscription>()
                .eq(TaskAnalyticsSubscription::getStatus, "active")
                .le(TaskAnalyticsSubscription::getNextSendAt, now)
                .orderByAsc(TaskAnalyticsSubscription::getNextSendAt)
                .last("LIMIT 100"));
        due.forEach(value -> {
            try {
                dispatcher.dispatchDue(value.getTenantId(), value.getId(), now,
                    nextTime(value.getScheduleConfig(), now));
            } catch (RuntimeException exception) {
                log.warn("Task analytics subscription {} dispatch failed: {}", value.getId(), exception.getMessage());
            }
        });
    }

    private List<Long> validate(SecurityUser user, SubscriptionRequest request) {
        if (!RECIPIENT_TYPES.contains(request.recipientType())) {
            throw BusinessException.badRequest("ANALYTICS_SUBSCRIPTION_RECIPIENT_INVALID", "接收人类型无效");
        }
        if (!CHANNELS.contains(request.channel())) {
            throw BusinessException.badRequest("ANALYTICS_SUBSCRIPTION_CHANNEL_INVALID", "发送渠道无效");
        }
        List<Long> ids = configuredIds(request.recipientConfig());
        if (ids.isEmpty()) {
            throw BusinessException.badRequest("ANALYTICS_SUBSCRIPTION_RECIPIENT_EMPTY", "必须选择接收人");
        }
        if (ids.size() > MAX_RECIPIENT_TARGETS) {
            throw BusinessException.badRequest("ANALYTICS_SUBSCRIPTION_RECIPIENT_LIMIT", "接收人或组不能超过 100 个");
        }
        validateSchedule(request.scheduleConfig());
        if ("group".equals(request.recipientType())) validateGroups(user, ids);
        else validateUsers(user, ids, request.channel());
        return ids;
    }

    private void validateGroups(SecurityUser operator, List<Long> groupIds) {
        Set<Long> manageable = visibilityService.groupIds(operator);
        boolean tenantScope = visibilityService.isTenantScope(operator);
        for (Long groupId : groupIds) {
            Group group = groupMapper.selectOne(new LambdaQueryWrapper<Group>()
                .eq(Group::getTenantId, operator.getTenantId()).eq(Group::getId, groupId)
                .eq(Group::getIsDeleted, false).eq(Group::getGroupType, "business"));
            if (group == null || !tenantScope && !manageable.contains(groupId)) {
                throw BusinessException.forbidden("ANALYTICS_SUBSCRIPTION_GROUP_DENIED", "接收组不存在或不在可管理范围内");
            }
        }
    }

    private void validateUsers(SecurityUser operator, List<Long> userIds, String channel) {
        Set<Long> manageable = visibilityService.groupIds(operator);
        boolean tenantScope = visibilityService.isTenantScope(operator);
        for (Long userId : userIds) {
            User recipient = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getTenantId, operator.getTenantId()).eq(User::getId, userId)
                .eq(User::getIsDeleted, false).eq(User::getStatus, 1));
            if (recipient == null) {
                throw BusinessException.badRequest("ANALYTICS_SUBSCRIPTION_USER_INVALID", "接收人不存在或已停用");
            }
            Set<Long> recipientGroups = new LinkedHashSet<>(membershipMapper
                .findEffectiveActiveBusinessGroupIds(operator.getTenantId(), userId));
            if (recipient.getGroupId() != null) recipientGroups.add(recipient.getGroupId());
            if (!tenantScope && !userId.equals(operator.getUserId())
                    && recipientGroups.stream().noneMatch(manageable::contains)) {
                throw BusinessException.forbidden("ANALYTICS_SUBSCRIPTION_USER_DENIED", "接收人不在可管理范围内");
            }
            if ("email".equals(channel) && (recipient.getEmail() == null || recipient.getEmail().isBlank())) {
                throw BusinessException.badRequest("ANALYTICS_SUBSCRIPTION_EMAIL_EMPTY", "邮件接收人缺少邮箱地址");
            }
        }
    }

    private void validateSchedule(Map<String, Object> config) {
        if (config == null) {
            throw BusinessException.badRequest("ANALYTICS_SUBSCRIPTION_SCHEDULE_INVALID", "必须配置发送计划");
        }
        String type = String.valueOf(config.getOrDefault("type", ""));
        if (!SCHEDULE_TYPES.contains(type)) {
            throw BusinessException.badRequest("ANALYTICS_SUBSCRIPTION_SCHEDULE_INVALID", "发送周期必须为每日、每周或每月");
        }
        parseTime(config);
        if ("weekly".equals(type)) integer(config, "dayOfWeek", 1, 7, 1);
        if ("monthly".equals(type)) integer(config, "dayOfMonth", 1, 28, 1);
    }

    private LocalDateTime nextTime(Map<String, Object> config, LocalDateTime from) {
        String type = String.valueOf(config.get("type"));
        LocalDateTime candidate = from.toLocalDate().atTime(parseTime(config));
        if (!candidate.isAfter(from)) candidate = candidate.plusDays(1);
        if ("weekly".equals(type)) {
            DayOfWeek target = DayOfWeek.of(integer(config, "dayOfWeek", 1, 7, 1));
            while (candidate.getDayOfWeek() != target) candidate = candidate.plusDays(1);
        }
        if ("monthly".equals(type)) {
            int targetDay = integer(config, "dayOfMonth", 1, 28, 1);
            candidate = candidate.withDayOfMonth(targetDay);
            if (!candidate.isAfter(from)) candidate = candidate.plusMonths(1).withDayOfMonth(targetDay);
        }
        return candidate;
    }

    private LocalTime parseTime(Map<String, Object> config) {
        try {
            return LocalTime.parse(String.valueOf(config.getOrDefault("time", "09:00")));
        } catch (DateTimeParseException exception) {
            throw BusinessException.badRequest("ANALYTICS_SUBSCRIPTION_SCHEDULE_INVALID", "发送时间格式无效");
        }
    }

    private int integer(Map<String, Object> config, String key, int min, int max, int defaultValue) {
        Object value = config.get(key);
        if (value == null) return defaultValue;
        try {
            int parsed = Integer.parseInt(String.valueOf(value));
            if (parsed < min || parsed > max) throw new NumberFormatException();
            return parsed;
        } catch (NumberFormatException exception) {
            throw BusinessException.badRequest("ANALYTICS_SUBSCRIPTION_SCHEDULE_INVALID", key + " 超出允许范围");
        }
    }

    private List<Long> configuredIds(Map<String, Object> config) {
        Object value = config == null ? null : config.get("ids");
        if (!(value instanceof List<?> ids)) return List.of();
        Set<Long> result = new LinkedHashSet<>();
        for (Object id : ids) {
            try {
                long parsed = Long.parseLong(String.valueOf(id));
                if (parsed <= 0) throw new NumberFormatException();
                result.add(parsed);
            } catch (NumberFormatException exception) {
                throw BusinessException.badRequest("ANALYTICS_SUBSCRIPTION_RECIPIENT_INVALID", "接收人 ID 必须为正整数");
            }
        }
        return new ArrayList<>(result);
    }

    private void apply(TaskAnalyticsSubscription value, SubscriptionRequest request, List<Long> recipientIds) {
        value.setName(request.name().trim());
        value.setRecipientType(request.recipientType());
        value.setRecipientConfig(new LinkedHashMap<>(Map.of("ids", recipientIds)));
        value.setScheduleConfig(new LinkedHashMap<>(request.scheduleConfig()));
        value.setChannel(request.channel());
    }

    private void requireManageDashboard(SecurityUser user, Long id) {
        AnalyticsDashboardVO dashboard = dashboardService.get(user, id);
        if (!dashboard.canManage()) {
            throw BusinessException.forbidden("ANALYTICS_SUBSCRIPTION_MANAGE_DENIED", "无权管理订阅");
        }
    }

    private TaskAnalyticsSubscription require(String tenantId, Long id) {
        TaskAnalyticsSubscription value = subscriptionMapper.selectOne(
            new LambdaQueryWrapper<TaskAnalyticsSubscription>()
                .eq(TaskAnalyticsSubscription::getTenantId, tenantId)
                .eq(TaskAnalyticsSubscription::getId, id)
                .ne(TaskAnalyticsSubscription::getStatus, "archived"));
        if (value == null) {
            throw new BusinessException(404, "ANALYTICS_SUBSCRIPTION_NOT_FOUND", "订阅不存在");
        }
        return value;
    }

    private SubscriptionVO toVO(TaskAnalyticsSubscription value) {
        return new SubscriptionVO(value.getId(), value.getDashboardId(), value.getName(), value.getRecipientType(),
            value.getRecipientConfig(), value.getScheduleConfig(), value.getChannel(), value.getStatus(),
            value.getLastSentAt(), value.getNextSendAt(), value.getCreatedAt(), value.getUpdatedAt());
    }
}
