package com.cwgsyw.platform.module.task.automation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.task.automation.dto.AutomationExecutionVO;
import com.cwgsyw.platform.module.task.automation.dto.AutomationPreviewRequest;
import com.cwgsyw.platform.module.task.automation.dto.AutomationPreviewVO;
import com.cwgsyw.platform.module.task.automation.dto.AutomationRuleRequest;
import com.cwgsyw.platform.module.task.automation.dto.AutomationRuleVO;
import com.cwgsyw.platform.module.task.automation.entity.TaskAutomationExecution;
import com.cwgsyw.platform.module.task.automation.entity.TaskAutomationRule;
import com.cwgsyw.platform.module.task.automation.mapper.TaskAutomationExecutionMapper;
import com.cwgsyw.platform.module.task.automation.mapper.TaskAutomationRuleMapper;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskInstanceMapper;
import com.cwgsyw.platform.module.task.template.service.TaskTemplateService;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TaskAutomationService {
    private static final Set<String> TRIGGERS = Set.of("submission_approved", "metric_threshold", "task_completed");
    private static final Set<String> ACTIONS = Set.of("create_task", "notify");

    private final TaskAutomationRuleMapper ruleMapper;
    private final TaskAutomationExecutionMapper executionMapper;
    private final TaskAutomationExecutor executor;
    private final TaskAutomationFailureRecorder failureRecorder;
    private final TaskAutomationConditionEvaluator conditionEvaluator;
    private final TaskTemplateService templateService;
    private final TaskInstanceMapper taskMapper;
    private final ObjectMapper objectMapper;

    public List<AutomationRuleVO> list(SecurityUser user) {
        return ruleMapper.selectList(new LambdaQueryWrapper<TaskAutomationRule>()
            .eq(TaskAutomationRule::getTenantId, user.getTenantId()).ne(TaskAutomationRule::getStatus, "archived")
            .orderByDesc(TaskAutomationRule::getUpdatedAt).orderByDesc(TaskAutomationRule::getId)).stream().map(this::toVO).toList();
    }

    public AutomationRuleVO get(SecurityUser user, Long id) { return toVO(require(user.getTenantId(), id)); }

    @Transactional(rollbackFor = Exception.class)
    public AutomationRuleVO create(SecurityUser user, AutomationRuleRequest request) {
        validate(request);
        TaskAutomationRule rule = new TaskAutomationRule();
        rule.setTenantId(user.getTenantId()); apply(rule, request); rule.setStatus("draft");
        conditionEvaluator.validate(rule);
        rule.setUpdatedBy(user.getUserId()); rule.setCreatedAt(LocalDateTime.now()); rule.setUpdatedAt(rule.getCreatedAt());
        ruleMapper.insert(rule); return toVO(rule);
    }

    @Transactional(rollbackFor = Exception.class)
    public AutomationRuleVO update(SecurityUser user, Long id, AutomationRuleRequest request) {
        validate(request); TaskAutomationRule rule = require(user.getTenantId(), id);
        if ("active".equals(rule.getStatus())) throw new BusinessException(409, "TASK_AUTOMATION_ACTIVE_IMMUTABLE", "运行中的规则请先暂停");
        apply(rule, request); conditionEvaluator.validate(rule); rule.setUpdatedBy(user.getUserId()); rule.setUpdatedAt(LocalDateTime.now()); ruleMapper.updateById(rule); return toVO(rule);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(SecurityUser user, Long id) {
        TaskAutomationRule rule = require(user.getTenantId(), id);
        rule.setStatus("archived");
        rule.setUpdatedBy(user.getUserId());
        rule.setUpdatedAt(LocalDateTime.now());
        ruleMapper.updateById(rule);
    }

    @Transactional(rollbackFor = Exception.class)
    public AutomationRuleVO activate(SecurityUser user, Long id) {
        TaskAutomationRule rule = require(user.getTenantId(), id);
        validateActivation(user, rule);
        conditionEvaluator.validate(rule);
        return lifecycle(user, rule, "active");
    }
    @Transactional(rollbackFor = Exception.class)
    public AutomationRuleVO pause(SecurityUser user, Long id) { return lifecycle(user, id, "paused"); }

    public List<AutomationExecutionVO> executions(SecurityUser user, Long ruleId) {
        require(user.getTenantId(), ruleId);
        return executionMapper.selectList(new LambdaQueryWrapper<TaskAutomationExecution>().eq(TaskAutomationExecution::getTenantId, user.getTenantId()).eq(TaskAutomationExecution::getRuleId, ruleId).orderByDesc(TaskAutomationExecution::getCreatedAt)).stream().map(this::toVO).toList();
    }

    public AutomationPreviewVO preview(SecurityUser user, Long ruleId, AutomationPreviewRequest request) {
        TaskAutomationRule rule = require(user.getTenantId(), ruleId);
        validateSourceTask(user.getTenantId(), request.sourceTaskId());
        Map<String, Object> action = rule.getActionConfig() == null ? Map.of() : new LinkedHashMap<>(rule.getActionConfig());
        boolean matched = conditionEvaluator.matches(rule, new TaskLifecycleEvent(user.getTenantId(), rule.getTriggerType(),
            request.sourceTaskId(), request.sourceSubmissionId(), LocalDateTime.now(), request.attributes()));
        return new AutomationPreviewVO(matched, matched ? "条件满足" : "触发条件不满足", action);
    }

    public void onEvent(TaskLifecycleEvent event) {
        List<TaskAutomationRule> rules = ruleMapper.selectList(new LambdaQueryWrapper<TaskAutomationRule>()
            .eq(TaskAutomationRule::getTenantId, event.tenantId()).eq(TaskAutomationRule::getStatus, "active")
            .eq(TaskAutomationRule::getTriggerType, event.eventType()));
        for (TaskAutomationRule rule : rules) {
            if (conditionEvaluator.matches(rule, event)) execute(rule, event);
        }
    }

    public void retry(SecurityUser user, Long executionId) {
        TaskAutomationExecution execution = executionMapper.selectOne(new LambdaQueryWrapper<TaskAutomationExecution>()
            .eq(TaskAutomationExecution::getTenantId, user.getTenantId()).eq(TaskAutomationExecution::getId, executionId));
        if (execution == null) throw new BusinessException(404, "TASK_AUTOMATION_EXECUTION_NOT_FOUND", "自动化执行记录不存在");
        if (!Set.of("failed", "dead").contains(execution.getStatus())) throw BusinessException.badRequest("TASK_AUTOMATION_RETRY_INVALID", "只有失败执行可以重试");
        if (executionMapper.requeue(user.getTenantId(), executionId, LocalDateTime.now()) != 1) {
            throw new BusinessException(409, "TASK_AUTOMATION_RETRY_CONFLICT", "自动化执行状态已变化，请刷新后重试");
        }
        executePending(execution.getTenantId(), executionId);
    }

    public void retryDue() {
        List<TaskAutomationExecution> failed = executionMapper.selectList(new LambdaQueryWrapper<TaskAutomationExecution>()
            .eq(TaskAutomationExecution::getStatus, "failed")
            .le(TaskAutomationExecution::getNextAttemptAt, LocalDateTime.now())
            .orderByAsc(TaskAutomationExecution::getNextAttemptAt).last("LIMIT 100"));
        failed.forEach(execution -> {
            if (executionMapper.requeue(execution.getTenantId(), execution.getId(), LocalDateTime.now()) == 1) {
                executePending(execution.getTenantId(), execution.getId());
            }
        });
        List<TaskAutomationExecution> pending = executionMapper.selectList(new LambdaQueryWrapper<TaskAutomationExecution>()
            .eq(TaskAutomationExecution::getStatus, "pending")
            .le(TaskAutomationExecution::getNextAttemptAt, LocalDateTime.now())
            .orderByAsc(TaskAutomationExecution::getNextAttemptAt).last("LIMIT 100"));
        pending.forEach(execution -> executePending(execution.getTenantId(), execution.getId()));
    }

    private void execute(TaskAutomationRule rule, TaskLifecycleEvent event) {
        if (event.sourceId() == null) throw BusinessException.badRequest("TASK_AUTOMATION_SOURCE_INVALID", "自动化事件缺少稳定来源标识");
        String dedupe = rule.getId() + ":" + event.eventType() + ":" + event.sourceType() + ":" + event.sourceId();
        if (executionMapper.claim(event.tenantId(), rule.getId(), event.sourceType(), event.sourceId(), event.eventType(),
            event.taskId(), event.submissionId(), event.occurredAt(), attributes(event), dedupe, LocalDateTime.now()) == 0) return;
        TaskAutomationExecution execution = executionMapper.selectOne(new LambdaQueryWrapper<TaskAutomationExecution>().eq(TaskAutomationExecution::getTenantId, event.tenantId()).eq(TaskAutomationExecution::getRuleId, rule.getId()).eq(TaskAutomationExecution::getDedupeKey, dedupe));
        execute(execution, rule, event);
    }

    private void executePending(String tenantId, Long executionId) {
        LocalDateTime now = LocalDateTime.now();
        if (executionMapper.claimPending(tenantId, executionId, now, now.plusMinutes(5)) != 1) return;
        TaskAutomationExecution execution = executionMapper.selectOne(new LambdaQueryWrapper<TaskAutomationExecution>()
            .eq(TaskAutomationExecution::getTenantId, tenantId).eq(TaskAutomationExecution::getId, executionId)
            .eq(TaskAutomationExecution::getStatus, "pending"));
        if (execution == null) return;
        TaskAutomationRule rule = require(tenantId, execution.getRuleId());
        execute(execution, rule, new TaskLifecycleEvent(tenantId, execution.getEventType(), execution.getSourceTaskId(),
            execution.getSourceSubmissionId(), execution.getSourceOccurredAt(), execution.getSourceAttributes()));
    }

    private void execute(TaskAutomationExecution execution, TaskAutomationRule rule, TaskLifecycleEvent event) {
        try {
            executor.execute(execution, rule, event);
        } catch (Exception exception) {
            failureRecorder.record(execution, exception);
        }
    }

    private AutomationRuleVO toVO(TaskAutomationRule r) { return new AutomationRuleVO(r.getId(), r.getName(), r.getDescription(), r.getTriggerType(), r.getTriggerConfig(), r.getConditionConfig(), r.getActionType(), r.getActionConfig(), r.getStatus(), r.getCreatedAt(), r.getUpdatedAt()); }
    private AutomationExecutionVO toVO(TaskAutomationExecution r) { return new AutomationExecutionVO(r.getId(), r.getRuleId(), r.getSourceType(), r.getSourceId(), r.getDedupeKey(), r.getStatus(), r.getResultTaskId(), r.getAttemptCount(), r.getNextAttemptAt(), r.getLastError(), r.getCreatedAt(), r.getUpdatedAt()); }
    private TaskAutomationRule require(String tenantId, Long id) { TaskAutomationRule r = ruleMapper.selectOne(new LambdaQueryWrapper<TaskAutomationRule>().eq(TaskAutomationRule::getTenantId, tenantId).eq(TaskAutomationRule::getId, id).ne(TaskAutomationRule::getStatus, "archived")); if (r == null) throw new BusinessException(404, "TASK_AUTOMATION_RULE_NOT_FOUND", "自动化规则不存在"); return r; }
    private AutomationRuleVO lifecycle(SecurityUser user, Long id, String status) { return lifecycle(user, require(user.getTenantId(), id), status); }
    private AutomationRuleVO lifecycle(SecurityUser user, TaskAutomationRule rule, String status) { rule.setStatus(status); rule.setUpdatedBy(user.getUserId()); rule.setUpdatedAt(LocalDateTime.now()); ruleMapper.updateById(rule); return toVO(rule); }
    private void validate(AutomationRuleRequest r) { if (!TRIGGERS.contains(r.triggerType())) throw BusinessException.badRequest("TASK_AUTOMATION_TRIGGER_INVALID", "触发类型无效"); if (!ACTIONS.contains(r.actionType())) throw BusinessException.badRequest("TASK_AUTOMATION_ACTION_INVALID", "动作类型无效"); if (r.triggerConfig() != null && r.triggerConfig().size() > 20 || r.actionConfig() != null && r.actionConfig().size() > 20) throw BusinessException.badRequest("TASK_AUTOMATION_CONFIG_INVALID", "自动化配置过于复杂"); }
    private void validateActivation(SecurityUser user, TaskAutomationRule rule) {
        Map<String, Object> config = rule.getActionConfig() == null ? Map.of() : rule.getActionConfig();
        if ("create_task".equals(rule.getActionType()) && (!positive(config.get("templateVersionId")) || !positive(config.get("assigneeId")))) {
            throw BusinessException.badRequest("TASK_AUTOMATION_ACTION_CONFIG_INVALID", "创建任务自动化必须配置已发布模板版本和执行人");
        }
        if ("create_task".equals(rule.getActionType())) {
            if (!user.getPermissions().contains("task:create")) throw BusinessException.forbidden("TASK_AUTOMATION_CREATE_FORBIDDEN", "无权激活自动创建任务规则");
            if (!"published".equals(templateService.getVersion(user.getTenantId(), Long.valueOf(String.valueOf(config.get("templateVersionId")))).getStatus())) {
                throw BusinessException.badRequest("TASK_AUTOMATION_TEMPLATE_UNPUBLISHED", "自动化只能使用已发布模板版本");
            }
        }
        if ("notify".equals(rule.getActionType()) && !positive(config.get("recipientId"))) {
            throw BusinessException.badRequest("TASK_AUTOMATION_ACTION_CONFIG_INVALID", "通知自动化必须配置接收人");
        }
    }
    private void apply(TaskAutomationRule r, AutomationRuleRequest q) { r.setName(q.name().trim()); r.setDescription(q.description()); r.setTriggerType(q.triggerType()); r.setTriggerConfig(q.triggerConfig() == null ? Map.of() : new LinkedHashMap<>(q.triggerConfig())); r.setConditionConfig(q.conditionConfig() == null ? Map.of() : new LinkedHashMap<>(q.conditionConfig())); r.setActionType(q.actionType()); r.setActionConfig(q.actionConfig() == null ? Map.of() : new LinkedHashMap<>(q.actionConfig())); }
    private boolean positive(Object value) {
        if (value == null) return false;
        try { return Long.parseLong(String.valueOf(value)) > 0; }
        catch (NumberFormatException exception) { return false; }
    }

    private String attributes(TaskLifecycleEvent event) {
        try {
            return objectMapper.writeValueAsString(event.attributes());
        } catch (JsonProcessingException exception) {
            throw BusinessException.badRequest("TASK_AUTOMATION_EVENT_INVALID", "自动化事件属性无法序列化");
        }
    }

    private void validateSourceTask(String tenantId, Long taskId) {
        if (taskMapper.selectCount(new LambdaQueryWrapper<TaskInstance>()
            .eq(TaskInstance::getTenantId, tenantId).eq(TaskInstance::getId, taskId)
            .eq(TaskInstance::getIsDeleted, false)) == 0) {
            throw new BusinessException(404, "TASK_NOT_FOUND", "来源任务不存在");
        }
    }
}
