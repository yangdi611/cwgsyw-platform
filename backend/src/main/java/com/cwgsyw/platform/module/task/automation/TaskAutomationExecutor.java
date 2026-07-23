package com.cwgsyw.platform.module.task.automation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.task.automation.entity.TaskAutomationExecution;
import com.cwgsyw.platform.module.task.automation.entity.TaskAutomationRule;
import com.cwgsyw.platform.module.task.automation.mapper.TaskAutomationExecutionMapper;
import com.cwgsyw.platform.module.task.notification.TaskNotificationOutbox;
import com.cwgsyw.platform.module.task.runtime.dto.CreateOneOffTaskRequest;
import com.cwgsyw.platform.module.task.runtime.service.TaskRuntimeService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TaskAutomationExecutor {
    private final TaskAutomationExecutionMapper executionMapper;
    private final TaskRuntimeService taskRuntimeService;
    private final TaskRelationService relationService;
    private final TaskNotificationOutbox notificationOutbox;
    private final UserMapper userMapper;
    private final RbacService rbacService;

    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void execute(TaskAutomationExecution execution, TaskAutomationRule rule, TaskLifecycleEvent event) {
        Map<String, Object> config = rule.getActionConfig() == null ? Map.of() : rule.getActionConfig();
        if ("create_task".equals(rule.getActionType())) {
            var task = taskRuntimeService.createOneOff(actor(rule), new CreateOneOffTaskRequest(
                requiredId(config, "templateVersionId"), optionalId(config, "approvalSchemeVersionId"),
                text(config, "title", "自动化任务"), text(config, "description", null), event.occurredAt(),
                event.occurredAt().plusHours(longValue(config, "dueHours", 24L)),
                text(config, "priority", "normal"), requiredId(config, "assigneeId"), optionalId(config, "groupId"),
                map(config.get("ciScopeConfig"))));
            execution.setResultTaskId(task.id());
            relationService.create(event.tenantId(), event.taskId(), task.id(),
                text(config, "relationType", "derived"), execution.getId());
        } else if ("notify".equals(rule.getActionType())) {
            Long recipientId = requiredId(config, "recipientId");
            User recipient = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getTenantId, event.tenantId()).eq(User::getId, recipientId)
                .eq(User::getIsDeleted, false).eq(User::getStatus, 1));
            if (recipient == null) throw BusinessException.badRequest("TASK_AUTOMATION_RECIPIENT_INVALID", "自动化通知接收人不存在或已停用");
            notificationOutbox.enqueue(event.tenantId(), event.taskId(), event.submissionId(), null,
                "automation_notify", recipientId, "notification", "automation:" + execution.getId(),
                Map.of("title", text(config, "title", "任务自动化通知"), "refType", "task", "refId", event.taskId()), LocalDateTime.now());
        }
        execution.setStatus("succeeded");
        execution.setAttemptCount((execution.getAttemptCount() == null ? 0 : execution.getAttemptCount()) + 1);
        execution.setNextAttemptAt(null);
        execution.setLastError(null);
        execution.setUpdatedAt(LocalDateTime.now());
        executionMapper.updateById(execution);
    }

    private SecurityUser actor(TaskAutomationRule rule) {
        User actor = userMapper.selectOne(new LambdaQueryWrapper<User>()
            .eq(User::getTenantId, rule.getTenantId()).eq(User::getId, rule.getUpdatedBy())
            .eq(User::getIsDeleted, false).eq(User::getStatus, 1));
        if (actor == null) throw BusinessException.forbidden("TASK_AUTOMATION_ACTOR_INVALID", "规则激活用户不存在或已停用");
        var permissions = rbacService.getUserPermissions(actor.getId());
        if (!permissions.contains("task:create")) {
            throw BusinessException.forbidden("TASK_AUTOMATION_CREATE_FORBIDDEN", "规则激活用户已失去任务创建权限");
        }
        return new SecurityUser(actor.getId(), actor.getUsername(), actor.getPassword(), actor.getTenantId(),
            actor.getGroupId(), rbacService.getHighestScope(actor.getId()), permissions);
    }

    private Long requiredId(Map<String, Object> values, String key) {
        Long value = optionalId(values, key);
        if (value == null || value <= 0) throw BusinessException.badRequest("TASK_AUTOMATION_ACTION_CONFIG_INVALID", "自动化动作缺少有效的 " + key);
        return value;
    }

    private Long optionalId(Map<String, Object> values, String key) {
        Object value = values.get(key);
        if (value == null) return null;
        try {
            return Long.valueOf(String.valueOf(value));
        } catch (NumberFormatException exception) {
            throw BusinessException.badRequest("TASK_AUTOMATION_ACTION_CONFIG_INVALID", "自动化动作中的 " + key + " 必须为数字");
        }
    }

    private long longValue(Map<String, Object> values, String key, long defaultValue) {
        Long value = optionalId(values, key);
        if (value == null) return defaultValue;
        if (value < 1) throw BusinessException.badRequest("TASK_AUTOMATION_ACTION_CONFIG_INVALID", "自动化动作中的 " + key + " 必须大于零");
        return value;
    }

    private String text(Map<String, Object> values, String key, String defaultValue) {
        Object value = values.get(key);
        return value == null ? defaultValue : String.valueOf(value);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> map(Object value) {
        return value instanceof Map<?, ?> ? new LinkedHashMap<>((Map<String, Object>) value) : Map.of();
    }
}
