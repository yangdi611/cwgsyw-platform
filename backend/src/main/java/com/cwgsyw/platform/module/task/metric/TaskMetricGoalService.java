package com.cwgsyw.platform.module.task.metric;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.task.metric.dto.MetricGoalRequest;
import com.cwgsyw.platform.module.task.metric.dto.MetricGoalVO;
import com.cwgsyw.platform.module.task.metric.dto.MetricPreviewRequest;
import com.cwgsyw.platform.module.task.metric.entity.TaskMetricDefinition;
import com.cwgsyw.platform.module.task.metric.entity.TaskMetricGoal;
import com.cwgsyw.platform.module.task.metric.mapper.TaskMetricDefinitionMapper;
import com.cwgsyw.platform.module.task.metric.mapper.TaskMetricGoalMapper;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TaskMetricGoalService {
    private static final Set<String> SCOPES = Set.of("tenant", "group", "user", "template");
    private static final Set<String> PERIODS = Set.of("daily", "weekly", "monthly", "quarterly", "yearly", "custom");
    private static final Set<String> COMPARISONS = Set.of("at_least", "at_most", "exact");

    private final TaskMetricGoalMapper goalMapper;
    private final TaskMetricDefinitionMapper definitionMapper;
    private final TaskMetricService metricService;

    public List<MetricGoalVO> list(SecurityUser user) {
        return goalMapper.selectList(new LambdaQueryWrapper<TaskMetricGoal>()
            .eq(TaskMetricGoal::getTenantId, user.getTenantId())
            .orderByDesc(TaskMetricGoal::getEffectiveFrom).orderByDesc(TaskMetricGoal::getId))
            .stream().map(goal -> toVO(user, goal)).toList();
    }

    @Transactional(rollbackFor = Exception.class)
    public MetricGoalVO create(SecurityUser user, MetricGoalRequest request) {
        validate(user.getTenantId(), request);
        TaskMetricGoal goal = new TaskMetricGoal();
        goal.setTenantId(user.getTenantId());
        apply(goal, request);
        goalMapper.insert(goal);
        return toVO(user, goal);
    }

    @Transactional(rollbackFor = Exception.class)
    public MetricGoalVO update(SecurityUser user, Long goalId, MetricGoalRequest request) {
        TaskMetricGoal goal = require(user.getTenantId(), goalId);
        validate(user.getTenantId(), request);
        apply(goal, request);
        goalMapper.updateById(goal);
        return toVO(user, goal);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(SecurityUser user, Long goalId) {
        TaskMetricGoal goal = require(user.getTenantId(), goalId);
        goalMapper.deleteById(goal);
    }

    private MetricGoalVO toVO(SecurityUser user, TaskMetricGoal goal) {
        TaskMetricDefinition metric = requireMetric(user.getTenantId(), goal.getMetricId());
        var preview = metricService.previewForScope(user, goal.getMetricId(),
            new MetricPreviewRequest(goal.getEffectiveFrom(), goal.getEffectiveTo(), null),
            goal.getScopeType(), goal.getScopeKey());
        BigDecimal actual = "manual_report".equals(preview.selectedSourceRole())
            ? preview.manualValue() : preview.systemValue();
        BigDecimal completion = completion(goal, actual);
        return new MetricGoalVO(goal.getId(), goal.getMetricId(), metric.getName(), goal.getScopeType(),
            goal.getScopeKey(), goal.getPeriodType(), copy(goal.getPeriodConfig()), goal.getTargetValue(), actual,
            completion, goal.getWarningThreshold(), goal.getCriticalThreshold(), goal.getComparison(),
            status(goal, actual), goal.getEffectiveFrom(), goal.getEffectiveTo());
    }

    private void validate(String tenantId, MetricGoalRequest request) {
        requireMetric(tenantId, request.metricId());
        if (!SCOPES.contains(request.scopeType())) throw BusinessException.badRequest("TASK_METRIC_GOAL_SCOPE_INVALID", "目标范围无效");
        if (!"tenant".equals(request.scopeType())) parseScopeKey(request.scopeKey(), request.scopeType());
        if ("tenant".equals(request.scopeType()) && request.scopeKey() != null && !request.scopeKey().isBlank()) {
            throw BusinessException.badRequest("TASK_METRIC_GOAL_SCOPE_INVALID", "租户范围不能指定范围键");
        }
        if (!PERIODS.contains(request.periodType())) throw BusinessException.badRequest("TASK_METRIC_GOAL_PERIOD_INVALID", "目标周期无效");
        if (!COMPARISONS.contains(request.comparison())) throw BusinessException.badRequest("TASK_METRIC_GOAL_COMPARISON_INVALID", "目标比较方式无效");
        if (request.effectiveFrom().isAfter(request.effectiveTo())) throw BusinessException.badRequest("TASK_METRIC_GOAL_RANGE_INVALID", "目标开始日期不能晚于结束日期");
        if (request.targetValue().signum() < 0) throw BusinessException.badRequest("TASK_METRIC_GOAL_TARGET_INVALID", "目标值不能为负数");
    }

    private void apply(TaskMetricGoal goal, MetricGoalRequest request) {
        goal.setMetricId(request.metricId());
        goal.setScopeType(request.scopeType());
        goal.setScopeKey("tenant".equals(request.scopeType()) ? null : request.scopeKey());
        goal.setPeriodType(request.periodType());
        goal.setPeriodConfig(copy(request.periodConfig()));
        goal.setEffectiveFrom(request.effectiveFrom());
        goal.setEffectiveTo(request.effectiveTo());
        goal.setTargetValue(request.targetValue());
        goal.setWarningThreshold(request.warningThreshold());
        goal.setCriticalThreshold(request.criticalThreshold());
        goal.setComparison(request.comparison());
    }

    private BigDecimal completion(TaskMetricGoal goal, BigDecimal actual) {
        if (actual == null) return BigDecimal.ZERO;
        if (goal.getTargetValue().signum() == 0) return actual.signum() == 0 ? BigDecimal.valueOf(100) : BigDecimal.ZERO;
        BigDecimal ratio = "at_most".equals(goal.getComparison())
            ? goal.getTargetValue().divide(actual.signum() == 0 ? goal.getTargetValue() : actual, 6, RoundingMode.HALF_UP)
            : actual.divide(goal.getTargetValue(), 6, RoundingMode.HALF_UP);
        return ratio.multiply(BigDecimal.valueOf(100)).min(BigDecimal.valueOf(999.99)).setScale(2, RoundingMode.HALF_UP);
    }

    private String status(TaskMetricGoal goal, BigDecimal actual) {
        if (actual == null) return "no_data";
        boolean met = switch (goal.getComparison()) {
            case "at_most" -> actual.compareTo(goal.getTargetValue()) <= 0;
            case "exact" -> actual.compareTo(goal.getTargetValue()) == 0;
            default -> actual.compareTo(goal.getTargetValue()) >= 0;
        };
        if (met) return "met";
        if (thresholdReached(actual, goal.getCriticalThreshold(), goal.getComparison())) return "critical";
        if (thresholdReached(actual, goal.getWarningThreshold(), goal.getComparison())) return "warning";
        return "not_met";
    }

    private boolean thresholdReached(BigDecimal actual, BigDecimal threshold, String comparison) {
        if (threshold == null) return false;
        return "at_most".equals(comparison) ? actual.compareTo(threshold) >= 0 : actual.compareTo(threshold) <= 0;
    }

    private TaskMetricGoal require(String tenantId, Long id) {
        TaskMetricGoal goal = goalMapper.selectOne(new LambdaQueryWrapper<TaskMetricGoal>()
            .eq(TaskMetricGoal::getTenantId, tenantId).eq(TaskMetricGoal::getId, id));
        if (goal == null) throw new BusinessException(404, "TASK_METRIC_GOAL_NOT_FOUND", "指标目标不存在");
        return goal;
    }

    private TaskMetricDefinition requireMetric(String tenantId, Long id) {
        TaskMetricDefinition metric = definitionMapper.selectOne(new LambdaQueryWrapper<TaskMetricDefinition>()
            .eq(TaskMetricDefinition::getTenantId, tenantId).eq(TaskMetricDefinition::getId, id));
        if (metric == null) throw new BusinessException(404, "TASK_METRIC_NOT_FOUND", "指标不存在");
        return metric;
    }

    private Long parseScopeKey(String value, String scopeType) {
        try {
            if (value == null || Long.parseLong(value) <= 0) throw new NumberFormatException();
            return Long.parseLong(value);
        } catch (NumberFormatException exception) {
            throw BusinessException.badRequest("TASK_METRIC_GOAL_SCOPE_INVALID", scopeType + " 范围必须指定有效 ID");
        }
    }

    private Map<String, Object> copy(Map<String, Object> value) { return value == null ? new LinkedHashMap<>() : new LinkedHashMap<>(value); }
}
