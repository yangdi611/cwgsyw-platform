package com.cwgsyw.platform.module.task.metric;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.task.automation.TaskLifecycleEvent;
import com.cwgsyw.platform.module.task.metric.dto.MetricBindingRequest;
import com.cwgsyw.platform.module.task.metric.dto.MetricBindingVO;
import com.cwgsyw.platform.module.task.metric.dto.MetricDefinitionRequest;
import com.cwgsyw.platform.module.task.metric.dto.MetricDefinitionVO;
import com.cwgsyw.platform.module.task.metric.dto.MetricPreviewRequest;
import com.cwgsyw.platform.module.task.metric.dto.MetricPreviewVO;
import com.cwgsyw.platform.module.task.metric.entity.TaskMetricBinding;
import com.cwgsyw.platform.module.task.metric.entity.TaskMetricDefinition;
import com.cwgsyw.platform.module.task.metric.entity.TaskMetricFact;
import com.cwgsyw.platform.module.task.metric.entity.TaskMetricGoal;
import com.cwgsyw.platform.module.task.metric.mapper.TaskMetricBindingMapper;
import com.cwgsyw.platform.module.task.metric.mapper.TaskMetricDefinitionMapper;
import com.cwgsyw.platform.module.task.metric.mapper.TaskMetricFactMapper;
import com.cwgsyw.platform.module.task.metric.mapper.TaskMetricGoalMapper;
import com.cwgsyw.platform.module.task.runtime.entity.TaskFieldFact;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskFieldFactMapper;
import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateVersionVO;
import com.cwgsyw.platform.module.task.template.service.TaskTemplateService;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TaskMetricService {
    private static final Set<String> VALUE_TYPES = Set.of("number", "ratio", "percentage", "duration", "count");
    private static final Set<String> AGGREGATIONS = Set.of("sum", "avg", "min", "max", "count", "weighted_avg", "ratio");
    private static final Set<String> ADDITIVITY = Set.of("additive", "non_additive", "semi_additive", "distinct", "snapshot", "formula");
    private static final Set<String> SOURCE_ROLES = Set.of("fact", "system_rollup", "manual_report");
    private static final Set<String> RATIO_COMPONENTS = Set.of("numerator", "denominator");
    private static final Set<String> NUMERIC_FIELDS = Set.of(
        "number", "money", "percentage", "rating", "duration", "formula", "aggregate_reference");

    private final TaskMetricDefinitionMapper definitionMapper;
    private final TaskMetricBindingMapper bindingMapper;
    private final TaskMetricFactMapper metricFactMapper;
    private final TaskMetricGoalMapper goalMapper;
    private final TaskFieldFactMapper fieldFactMapper;
    private final TaskTemplateService templateService;
    private final ApplicationEventPublisher eventPublisher;

    public List<MetricDefinitionVO> list(SecurityUser user) {
        return definitionMapper.selectList(new LambdaQueryWrapper<TaskMetricDefinition>()
            .eq(TaskMetricDefinition::getTenantId, user.getTenantId())
            .orderByAsc(TaskMetricDefinition::getName).orderByAsc(TaskMetricDefinition::getId))
            .stream().map(value -> toVO(value, true)).toList();
    }

    public MetricDefinitionVO get(SecurityUser user, Long metricId) {
        return toVO(requireMetric(user.getTenantId(), metricId), true);
    }

    @Transactional(rollbackFor = Exception.class)
    public MetricDefinitionVO create(SecurityUser user, MetricDefinitionRequest request) {
        validateDefinition(request);
        if (definitionMapper.selectCount(new LambdaQueryWrapper<TaskMetricDefinition>()
                .eq(TaskMetricDefinition::getTenantId, user.getTenantId())
                .eq(TaskMetricDefinition::getCode, request.code().trim())) > 0) {
            throw conflict("TASK_METRIC_CODE_CONFLICT", "指标编码已存在");
        }
        TaskMetricDefinition value = new TaskMetricDefinition();
        value.setTenantId(user.getTenantId());
        apply(value, request);
        value.setCreatedAt(LocalDateTime.now());
        value.setUpdatedAt(value.getCreatedAt());
        definitionMapper.insert(value);
        return toVO(value, true);
    }

    @Transactional(rollbackFor = Exception.class)
    public MetricDefinitionVO update(SecurityUser user, Long metricId, MetricDefinitionRequest request) {
        validateDefinition(request);
        TaskMetricDefinition value = requireMetric(user.getTenantId(), metricId);
        long duplicate = definitionMapper.selectCount(new LambdaQueryWrapper<TaskMetricDefinition>()
            .eq(TaskMetricDefinition::getTenantId, user.getTenantId())
            .eq(TaskMetricDefinition::getCode, request.code().trim())
            .ne(TaskMetricDefinition::getId, metricId));
        if (duplicate > 0) throw conflict("TASK_METRIC_CODE_CONFLICT", "指标编码已存在");
        requireNoFacts(user.getTenantId(), metricId, "TASK_METRIC_IN_USE", "指标已有正式事实，不能修改");
        apply(value, request);
        value.setUpdatedAt(LocalDateTime.now());
        definitionMapper.updateById(value);
        return toVO(value, true);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(SecurityUser user, Long metricId) {
        TaskMetricDefinition value = requireMetric(user.getTenantId(), metricId);
        requireNoFacts(user.getTenantId(), metricId, "TASK_METRIC_IN_USE", "指标已有正式事实，不能删除");
        if (goalMapper.selectCount(new LambdaQueryWrapper<TaskMetricGoal>()
                .eq(TaskMetricGoal::getTenantId, user.getTenantId()).eq(TaskMetricGoal::getMetricId, metricId)) > 0) {
            throw conflict("TASK_METRIC_IN_USE", "指标仍被目标配置引用，不能删除");
        }
        bindingMapper.delete(new LambdaQueryWrapper<TaskMetricBinding>()
            .eq(TaskMetricBinding::getTenantId, user.getTenantId()).eq(TaskMetricBinding::getMetricId, metricId));
        definitionMapper.deleteById(value.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public MetricBindingVO addBinding(SecurityUser user, Long metricId, MetricBindingRequest request) {
        TaskMetricDefinition metric = requireMetric(user.getTenantId(), metricId);
        TaskTemplateVersionVO version = templateService.getVersion(user.getTenantId(), request.templateVersionId());
        TaskFieldDefinition field = version.getFields().stream().filter(item -> request.fieldId().equals(item.getId()))
            .findFirst().orElseThrow(() -> BusinessException.badRequest("TASK_METRIC_FIELD_NOT_FOUND", "模板字段不存在"));
        validateBinding(metric, field, request);
        TaskMetricBinding binding = new TaskMetricBinding();
        binding.setTenantId(user.getTenantId());
        binding.setMetricId(metricId);
        binding.setTemplateVersionId(request.templateVersionId());
        binding.setFieldId(request.fieldId());
        binding.setFieldKey(field.getKey());
        binding.setSourceRole(request.sourceRole());
        binding.setRatioComponent(request.ratioComponent());
        binding.setUnitConversion(copy(request.unitConversion()));
        conversionFactor(request.unitConversion());
        binding.setEnabled(!Boolean.FALSE.equals(request.enabled()));
        try {
            bindingMapper.insert(binding);
        } catch (DuplicateKeyException exception) {
            throw conflict("TASK_METRIC_BINDING_CONFLICT", "该模板字段已绑定此指标");
        }
        backfill(binding);
        return toVO(binding, field);
    }

    @Transactional(rollbackFor = Exception.class)
    public MetricBindingVO updateBinding(SecurityUser user, Long bindingId, MetricBindingRequest request) {
        TaskMetricBinding binding = requireBinding(user.getTenantId(), bindingId);
        requireNoFactsForBinding(user.getTenantId(), bindingId, "指标绑定已有正式事实，不能修改");
        if (!binding.getTemplateVersionId().equals(request.templateVersionId()) || !binding.getFieldId().equals(request.fieldId())) {
            throw BusinessException.badRequest("TASK_METRIC_BINDING_SOURCE_IMMUTABLE", "绑定的数据源不可修改，请删除后重新创建");
        }
        TaskMetricDefinition metric = requireMetric(user.getTenantId(), binding.getMetricId());
        TaskTemplateVersionVO version = templateService.getVersion(user.getTenantId(), request.templateVersionId());
        TaskFieldDefinition field = version.getFields().stream().filter(item -> request.fieldId().equals(item.getId()))
            .findFirst().orElseThrow(() -> BusinessException.badRequest("TASK_METRIC_FIELD_NOT_FOUND", "模板字段不存在"));
        validateBinding(metric, field, request);
        binding.setSourceRole(request.sourceRole());
        binding.setRatioComponent(request.ratioComponent());
        binding.setUnitConversion(copy(request.unitConversion()));
        conversionFactor(request.unitConversion());
        binding.setEnabled(!Boolean.FALSE.equals(request.enabled()));
        bindingMapper.updateById(binding);
        if (Boolean.TRUE.equals(binding.getEnabled())) backfill(binding);
        return toVO(binding, field);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteBinding(SecurityUser user, Long bindingId) {
        TaskMetricBinding binding = requireBinding(user.getTenantId(), bindingId);
        requireNoFactsForBinding(user.getTenantId(), bindingId, "指标绑定已有正式事实，不能删除");
        bindingMapper.deleteById(bindingId);
    }

    public MetricPreviewVO preview(SecurityUser user, Long metricId, MetricPreviewRequest request) {
        return previewForScope(user, metricId, request, "tenant", null);
    }

    /** Computes the same authoritative metric result with a goal-specific dimension scope. */
    public MetricPreviewVO previewForScope(SecurityUser user, Long metricId, MetricPreviewRequest request,
                                           String scopeType, String scopeKey) {
        TaskMetricDefinition metric = requireMetric(user.getTenantId(), metricId);
        if (request.from().isAfter(request.to())) {
            throw BusinessException.badRequest("TASK_METRIC_TIME_RANGE_INVALID", "开始日期不能晚于结束日期");
        }
        LambdaQueryWrapper<TaskMetricFact> query = new LambdaQueryWrapper<TaskMetricFact>()
            .eq(TaskMetricFact::getTenantId, user.getTenantId()).eq(TaskMetricFact::getMetricId, metricId)
            .eq(TaskMetricFact::getEffective, true)
            .ge(TaskMetricFact::getBusinessDate, request.from()).le(TaskMetricFact::getBusinessDate, request.to())
            .eq(request.groupId() != null, TaskMetricFact::getOwnerGroupId, request.groupId());
        applyScope(user.getTenantId(), metricId, query, scopeType, scopeKey);
        List<TaskMetricFact> facts = metricFactMapper.selectList(query.orderByAsc(TaskMetricFact::getBusinessDate)
            .orderByAsc(TaskMetricFact::getId));
        List<TaskMetricFact> system = facts.stream().filter(fact -> !"manual_report".equals(fact.getSourceType())).toList();
        List<TaskMetricFact> manual = facts.stream().filter(fact -> "manual_report".equals(fact.getSourceType())).toList();
        BigDecimal systemValue = aggregate(metric, authoritative(metric, system));
        BigDecimal manualValue = aggregate(metric, manual);
        String selected = selectedSource(metric, system, manual);
        List<TaskMetricFact> selectedFacts = "manual_report".equals(selected) ? manual : authoritative(metric, system);
        return new MetricPreviewVO(metricId, request.from(), request.to(), systemValue, manualValue,
            difference(manualValue, systemValue), selected, new LinkedHashSet<>(selectedFacts.stream()
                .map(TaskMetricFact::getTaskId).toList()).size(), selectedFacts.stream().map(TaskMetricFact::getId).toList(),
            selectedFacts.stream().map(TaskMetricFact::getTaskId).distinct().toList(),
            selectedFacts.stream().map(TaskMetricFact::getSubmissionId).distinct().toList());
    }

    private void applyScope(String tenantId, Long metricId, LambdaQueryWrapper<TaskMetricFact> query,
                            String scopeType, String scopeKey) {
        String type = scopeType == null ? "tenant" : scopeType;
        switch (type) {
            case "tenant" -> {
                if (scopeKey != null) throw BusinessException.badRequest("TASK_METRIC_GOAL_SCOPE_INVALID", "租户范围不能指定范围键");
            }
            case "group" -> query.eq(TaskMetricFact::getOwnerGroupId, positiveScopeKey(scopeKey, type));
            case "user" -> query.eq(TaskMetricFact::getOwnerUserId, positiveScopeKey(scopeKey, type));
            case "template" -> {
                Long templateVersionId = positiveScopeKey(scopeKey, type);
                List<Long> bindingIds = bindingMapper.selectList(new LambdaQueryWrapper<TaskMetricBinding>()
                        .eq(TaskMetricBinding::getTenantId, tenantId).eq(TaskMetricBinding::getMetricId, metricId)
                        .eq(TaskMetricBinding::getTemplateVersionId, templateVersionId).eq(TaskMetricBinding::getEnabled, true))
                    .stream().map(TaskMetricBinding::getId).toList();
                if (bindingIds.isEmpty()) query.apply("1 = 0");
                else query.in(TaskMetricFact::getBindingId, bindingIds);
            }
            default -> throw BusinessException.badRequest("TASK_METRIC_GOAL_SCOPE_INVALID", "目标范围无效");
        }
    }

    private Long positiveScopeKey(String value, String scopeType) {
        try {
            long parsed = Long.parseLong(value);
            if (parsed > 0) return parsed;
        } catch (NumberFormatException | NullPointerException ignored) {
            // Converted to the stable domain error below.
        }
        throw BusinessException.badRequest("TASK_METRIC_GOAL_SCOPE_INVALID", scopeType + " 范围必须指定有效 ID");
    }

    @Transactional(rollbackFor = Exception.class)
    public void syncSubmission(String tenantId, Long submissionId, boolean active) {
        List<TaskFieldFact> fieldFacts = fieldFactMapper.selectList(new LambdaQueryWrapper<TaskFieldFact>()
            .eq(TaskFieldFact::getTenantId, tenantId).eq(TaskFieldFact::getSubmissionId, submissionId)
            .isNotNull(TaskFieldFact::getValueNumber));
        if (fieldFacts.isEmpty()) return;
        Set<Long> versionIds = fieldFacts.stream().map(TaskFieldFact::getTemplateVersionId)
            .collect(java.util.stream.Collectors.toSet());
        List<TaskMetricBinding> bindings = bindingMapper.selectList(new LambdaQueryWrapper<TaskMetricBinding>()
            .eq(TaskMetricBinding::getTenantId, tenantId).in(TaskMetricBinding::getTemplateVersionId, versionIds)
            .eq(TaskMetricBinding::getEnabled, true));
        Map<String, TaskMetricBinding> bySource = new LinkedHashMap<>();
        Map<String, TaskFieldFact> factsBySourceAndRow = new LinkedHashMap<>();
        bindings.stream().filter(binding -> binding.getRatioComponent() == null)
            .forEach(binding -> bySource.put(binding.getTemplateVersionId() + ":" + binding.getFieldKey(), binding));
        fieldFacts.forEach(fieldFact -> factsBySourceAndRow.put(fieldFact.getTemplateVersionId() + ":" + fieldFact.getFieldKey()
            + ":" + rowKey(fieldFact), fieldFact));
        for (TaskFieldFact fieldFact : fieldFacts) {
            TaskMetricBinding binding = bySource.get(fieldFact.getTemplateVersionId() + ":" + fieldFact.getFieldKey());
            if (binding == null) continue;
            TaskMetricFact created = insertMetricFact(binding, fieldFact, active);
            if (active && created != null) publishMetricThreshold(created);
        }
        for (TaskMetricBinding numerator : bindings) {
            if (!"numerator".equals(numerator.getRatioComponent())) continue;
            TaskMetricBinding denominator = ratioPeer(bindings, numerator, "denominator");
            if (denominator == null) continue;
            for (TaskFieldFact numeratorFact : fieldFacts) {
                if (!sameSource(numeratorFact, numerator)) continue;
                TaskFieldFact denominatorFact = factsBySourceAndRow.get(denominator.getTemplateVersionId() + ":"
                    + denominator.getFieldKey() + ":" + rowKey(numeratorFact));
                if (denominatorFact == null) continue;
                TaskMetricFact created = insertRatioMetricFact(numerator, denominator, numeratorFact, denominatorFact, active);
                if (active && created != null) publishMetricThreshold(created);
            }
        }
    }

    public void activateSubmission(String tenantId, Long taskId, Long submissionId, LocalDateTime now) {
        metricFactMapper.deactivateTaskFacts(tenantId, taskId, now);
        metricFactMapper.activateSubmissionFacts(tenantId, submissionId, now)
            .forEach(this::publishMetricThreshold);
    }

    public void deactivateTask(String tenantId, Long taskId, LocalDateTime now) {
        metricFactMapper.deactivateTaskFacts(tenantId, taskId, now);
    }

    private void backfill(TaskMetricBinding binding) {
        if (binding.getRatioComponent() != null) {
            backfillRatio(binding);
            return;
        }
        fieldFactMapper.selectList(new LambdaQueryWrapper<TaskFieldFact>()
            .eq(TaskFieldFact::getTenantId, binding.getTenantId())
            .eq(TaskFieldFact::getTemplateVersionId, binding.getTemplateVersionId())
            .eq(TaskFieldFact::getFieldKey, binding.getFieldKey()).isNotNull(TaskFieldFact::getValueNumber))
            .forEach(fieldFact -> insertMetricFact(binding, fieldFact, Boolean.TRUE.equals(fieldFact.getIsActive())));
    }

    private void backfillRatio(TaskMetricBinding binding) {
        TaskMetricBinding numerator = "numerator".equals(binding.getRatioComponent()) ? binding
            : ratioPeer(bindingMapper.selectList(new LambdaQueryWrapper<TaskMetricBinding>()
                .eq(TaskMetricBinding::getTenantId, binding.getTenantId())
                .eq(TaskMetricBinding::getMetricId, binding.getMetricId())
                .eq(TaskMetricBinding::getTemplateVersionId, binding.getTemplateVersionId())
                .eq(TaskMetricBinding::getSourceRole, binding.getSourceRole())
                .eq(TaskMetricBinding::getEnabled, true)), binding, "numerator");
        if (numerator == null) return;
        List<TaskMetricBinding> candidates = bindingMapper.selectList(new LambdaQueryWrapper<TaskMetricBinding>()
            .eq(TaskMetricBinding::getTenantId, binding.getTenantId())
            .eq(TaskMetricBinding::getMetricId, binding.getMetricId())
            .eq(TaskMetricBinding::getTemplateVersionId, binding.getTemplateVersionId())
            .eq(TaskMetricBinding::getSourceRole, binding.getSourceRole())
            .eq(TaskMetricBinding::getEnabled, true));
        TaskMetricBinding denominator = ratioPeer(candidates, numerator, "denominator");
        if (denominator == null) return;
        List<TaskFieldFact> facts = fieldFactMapper.selectList(new LambdaQueryWrapper<TaskFieldFact>()
            .eq(TaskFieldFact::getTenantId, binding.getTenantId())
            .eq(TaskFieldFact::getTemplateVersionId, binding.getTemplateVersionId())
            .in(TaskFieldFact::getFieldKey, List.of(numerator.getFieldKey(), denominator.getFieldKey()))
            .isNotNull(TaskFieldFact::getValueNumber));
        Map<String, TaskFieldFact> bySourceAndRow = new LinkedHashMap<>();
        facts.forEach(fact -> bySourceAndRow.put(fact.getSubmissionId() + ":" + fact.getFieldKey() + ":" + rowKey(fact), fact));
        facts.stream().filter(fact -> sameSource(fact, numerator)).forEach(numeratorFact -> {
            TaskFieldFact denominatorFact = bySourceAndRow.get(numeratorFact.getSubmissionId() + ":"
                + denominator.getFieldKey() + ":" + rowKey(numeratorFact));
            if (denominatorFact != null) insertRatioMetricFact(numerator, denominator, numeratorFact, denominatorFact,
                Boolean.TRUE.equals(numeratorFact.getIsActive()));
        });
    }

    private TaskMetricFact insertMetricFact(TaskMetricBinding binding, TaskFieldFact fieldFact, boolean active) {
        long existing = metricFactMapper.selectCount(new LambdaQueryWrapper<TaskMetricFact>()
            .eq(TaskMetricFact::getMetricId, binding.getMetricId()).eq(TaskMetricFact::getFieldFactId, fieldFact.getId())
            .eq(TaskMetricFact::getSourceType, binding.getSourceRole()));
        if (existing > 0) return null;
        TaskMetricFact fact = new TaskMetricFact();
        fact.setTenantId(fieldFact.getTenantId());
        fact.setMetricId(binding.getMetricId());
        fact.setBindingId(binding.getId());
        fact.setSubmissionId(fieldFact.getSubmissionId());
        fact.setTaskId(fieldFact.getTaskId());
        fact.setFieldFactId(fieldFact.getId());
        fact.setValue(fieldFact.getValueNumber().multiply(conversionFactor(binding.getUnitConversion())));
        fact.setBusinessDate(fieldFact.getBusinessDate());
        fact.setOwnerUserId(fieldFact.getOwnerUserId());
        fact.setOwnerUserName(fieldFact.getOwnerUserName());
        fact.setOwnerGroupId(fieldFact.getOwnerGroupId());
        fact.setOwnerGroupName(fieldFact.getOwnerGroupName());
        fact.setDimensions(copy(fieldFact.getDimensionSnapshot()));
        fact.setSourceType(binding.getSourceRole());
        fact.setEffective(active);
        fact.setCreatedAt(LocalDateTime.now());
        metricFactMapper.insert(fact);
        return fact;
    }

    private TaskMetricFact insertRatioMetricFact(TaskMetricBinding numeratorBinding, TaskMetricBinding denominatorBinding,
                                                  TaskFieldFact numeratorFact, TaskFieldFact denominatorFact, boolean active) {
        long existing = metricFactMapper.selectCount(new LambdaQueryWrapper<TaskMetricFact>()
            .eq(TaskMetricFact::getMetricId, numeratorBinding.getMetricId())
            .eq(TaskMetricFact::getFieldFactId, numeratorFact.getId())
            .eq(TaskMetricFact::getSourceType, numeratorBinding.getSourceRole()));
        if (existing > 0) return null;
        BigDecimal numerator = numeratorFact.getValueNumber().multiply(conversionFactor(numeratorBinding.getUnitConversion()));
        BigDecimal denominator = denominatorFact.getValueNumber().multiply(conversionFactor(denominatorBinding.getUnitConversion()));
        int scale = requireMetric(numeratorBinding.getTenantId(), numeratorBinding.getMetricId()).getScale();
        TaskMetricFact fact = new TaskMetricFact();
        fact.setTenantId(numeratorFact.getTenantId());
        fact.setMetricId(numeratorBinding.getMetricId());
        fact.setBindingId(numeratorBinding.getId());
        fact.setSubmissionId(numeratorFact.getSubmissionId());
        fact.setTaskId(numeratorFact.getTaskId());
        fact.setFieldFactId(numeratorFact.getId());
        fact.setDenominatorFieldFactId(denominatorFact.getId());
        fact.setNumerator(numerator);
        fact.setDenominator(denominator);
        fact.setValue(denominator.signum() == 0 ? null : numerator.divide(denominator, scale, RoundingMode.HALF_UP));
        fact.setBusinessDate(numeratorFact.getBusinessDate());
        fact.setOwnerUserId(numeratorFact.getOwnerUserId());
        fact.setOwnerUserName(numeratorFact.getOwnerUserName());
        fact.setOwnerGroupId(numeratorFact.getOwnerGroupId());
        fact.setOwnerGroupName(numeratorFact.getOwnerGroupName());
        fact.setDimensions(copy(numeratorFact.getDimensionSnapshot()));
        fact.setSourceType(numeratorBinding.getSourceRole());
        fact.setEffective(active);
        fact.setCreatedAt(LocalDateTime.now());
        metricFactMapper.insert(fact);
        return fact;
    }

    private void publishMetricThreshold(TaskMetricFact fact) {
        if (fact.getId() == null || !Boolean.TRUE.equals(fact.getEffective())) return;
        Map<String, Object> attributes = new LinkedHashMap<>();
        attributes.put("metricFactId", fact.getId());
        attributes.put("metricId", fact.getMetricId());
        if (fact.getValue() == null) return;
        attributes.put("metricValue", fact.getValue());
        putIfPresent(attributes, "businessDate", fact.getBusinessDate());
        putIfPresent(attributes, "ownerUserId", fact.getOwnerUserId());
        putIfPresent(attributes, "ownerGroupId", fact.getOwnerGroupId());
        putIfPresent(attributes, "sourceType", fact.getSourceType());
        eventPublisher.publishEvent(new TaskLifecycleEvent(fact.getTenantId(), "metric_threshold",
            fact.getTaskId(), fact.getSubmissionId(), fact.getCreatedAt(), attributes));
    }

    private void putIfPresent(Map<String, Object> target, String key, Object value) {
        if (value != null) target.put(key, value);
    }

    private void validateDefinition(MetricDefinitionRequest request) {
        if (!VALUE_TYPES.contains(request.valueType())) throw BusinessException.badRequest("TASK_METRIC_VALUE_TYPE_INVALID", "指标值类型无效");
        if (!AGGREGATIONS.contains(request.aggregation())) throw BusinessException.badRequest("TASK_METRIC_AGGREGATION_INVALID", "指标聚合方式无效");
        if (!ADDITIVITY.contains(request.additivity())) throw BusinessException.badRequest("TASK_METRIC_ADDITIVITY_INVALID", "指标可加性无效");
        if ("ratio".equals(request.valueType()) && !"ratio".equals(request.aggregation())) {
            throw BusinessException.badRequest("TASK_METRIC_RATIO_AGGREGATION_REQUIRED", "比率指标必须使用 ratio 聚合");
        }
    }

    private void validateBinding(TaskMetricDefinition metric, TaskFieldDefinition field, MetricBindingRequest request) {
        if (!SOURCE_ROLES.contains(request.sourceRole())) throw BusinessException.badRequest("TASK_METRIC_SOURCE_ROLE_INVALID", "指标来源角色无效");
        if (Boolean.TRUE.equals(field.getSensitive()) || field.getAnalytics() == null
                || !Boolean.TRUE.equals(field.getAnalytics().get("enabled"))) {
            throw BusinessException.badRequest("TASK_METRIC_FIELD_NOT_ANALYTIC", "字段未启用统计或属于敏感字段");
        }
        if (!NUMERIC_FIELDS.contains(field.getType()) && !"count".equals(metric.getValueType())) {
            throw BusinessException.badRequest("TASK_METRIC_FIELD_TYPE_INCOMPATIBLE", "该字段类型不能绑定当前指标");
        }
        boolean ratio = "ratio".equals(metric.getValueType());
        if (ratio && (request.ratioComponent() == null || !RATIO_COMPONENTS.contains(request.ratioComponent()))) {
            throw BusinessException.badRequest("TASK_METRIC_RATIO_COMPONENT_REQUIRED", "比率指标来源必须指定分子或分母");
        }
        if (!ratio && request.ratioComponent() != null) {
            throw BusinessException.badRequest("TASK_METRIC_RATIO_COMPONENT_INVALID", "仅比率指标可以配置分子或分母");
        }
        String sourceUnit = text(field.getAnalytics().get("unit"));
        if (!ratio && StringUtils.hasText(metric.getUnit()) && StringUtils.hasText(sourceUnit)
                && !metric.getUnit().equals(sourceUnit) && request.unitConversion() == null) {
            throw BusinessException.badRequest("TASK_METRIC_UNIT_CONVERSION_REQUIRED", "字段单位与指标单位不同，必须配置单位换算");
        }
    }

    private List<TaskMetricFact> authoritative(TaskMetricDefinition metric, List<TaskMetricFact> facts) {
        String role = text(metric.getAuthorityPolicy() == null ? null : metric.getAuthorityPolicy().get("sourceRole"));
        if (!StringUtils.hasText(role)) role = "fact";
        String selected = role;
        List<TaskMetricFact> preferred = facts.stream().filter(fact -> selected.equals(fact.getSourceType())).toList();
        return preferred.isEmpty() ? facts : preferred;
    }

    private BigDecimal aggregate(TaskMetricDefinition metric, List<TaskMetricFact> facts) {
        List<BigDecimal> values = facts.stream().map(TaskMetricFact::getValue).filter(java.util.Objects::nonNull).toList();
        if (values.isEmpty()) return null;
        int scale = metric.getScale() == null ? 4 : metric.getScale();
        return switch (metric.getAggregation()) {
            case "avg", "weighted_avg" -> values.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(values.size()), scale, RoundingMode.HALF_UP);
            case "min" -> values.stream().min(BigDecimal::compareTo).orElse(null);
            case "max" -> values.stream().max(BigDecimal::compareTo).orElse(null);
            case "count" -> BigDecimal.valueOf(values.size());
            case "ratio" -> {
                BigDecimal numerator = facts.stream().map(TaskMetricFact::getNumerator).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal denominator = facts.stream().map(TaskMetricFact::getDenominator).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
                yield denominator.signum() == 0 ? null : numerator.divide(denominator, scale, RoundingMode.HALF_UP);
            }
            default -> values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        };
    }

    private String selectedSource(TaskMetricDefinition metric, List<TaskMetricFact> system, List<TaskMetricFact> manual) {
        String preferred = text(metric.getAuthorityPolicy() == null ? null : metric.getAuthorityPolicy().get("sourceRole"));
        if ("manual_report".equals(preferred) && !manual.isEmpty()) return preferred;
        return system.isEmpty() && !manual.isEmpty() ? "manual_report" : StringUtils.hasText(preferred) ? preferred : "fact";
    }

    private BigDecimal difference(BigDecimal manual, BigDecimal system) {
        return manual == null || system == null ? null : manual.subtract(system);
    }

    private void apply(TaskMetricDefinition value, MetricDefinitionRequest request) {
        value.setCode(request.code().trim());
        value.setName(request.name().trim());
        value.setDescription(request.description());
        value.setValueType(request.valueType());
        value.setUnit(request.unit());
        value.setScale(request.scale() == null ? 4 : request.scale());
        value.setAggregation(request.aggregation());
        value.setAdditivity(request.additivity());
        value.setFormulaConfig(copy(request.formulaConfig()));
        value.setAuthorityPolicy(copy(request.authorityPolicy()));
    }

    private MetricDefinitionVO toVO(TaskMetricDefinition value, boolean includeBindings) {
        List<MetricBindingVO> bindings = includeBindings ? bindingMapper.selectList(new LambdaQueryWrapper<TaskMetricBinding>()
            .eq(TaskMetricBinding::getTenantId, value.getTenantId()).eq(TaskMetricBinding::getMetricId, value.getId())
            .orderByAsc(TaskMetricBinding::getId)).stream().map(this::toVO).toList() : List.of();
        return new MetricDefinitionVO(value.getId(), value.getCode(), value.getName(), value.getDescription(),
            value.getValueType(), value.getUnit(), value.getScale(), value.getAggregation(), value.getAdditivity(),
            copy(value.getFormulaConfig()), copy(value.getAuthorityPolicy()), bindings, value.getCreatedAt(), value.getUpdatedAt());
    }

    private MetricBindingVO toVO(TaskMetricBinding value) {
        TaskTemplateVersionVO version = templateService.getVersion(value.getTenantId(), value.getTemplateVersionId());
        TaskFieldDefinition field = version.getFields().stream().filter(item -> value.getFieldId().equals(item.getId()))
            .findFirst().orElse(null);
        return toVO(value, field);
    }

    private MetricBindingVO toVO(TaskMetricBinding value, TaskFieldDefinition field) {
        return new MetricBindingVO(value.getId(), value.getMetricId(), value.getTemplateVersionId(), value.getFieldId(),
            value.getFieldKey(), field == null ? value.getFieldKey() : field.getLabel(), field == null ? null : field.getType(),
            value.getSourceRole(), value.getRatioComponent(), copy(value.getUnitConversion()), Boolean.TRUE.equals(value.getEnabled()));
    }

    private TaskMetricDefinition requireMetric(String tenantId, Long metricId) {
        TaskMetricDefinition value = definitionMapper.selectOne(new LambdaQueryWrapper<TaskMetricDefinition>()
            .eq(TaskMetricDefinition::getTenantId, tenantId).eq(TaskMetricDefinition::getId, metricId));
        if (value == null) throw new BusinessException(404, "TASK_METRIC_NOT_FOUND", "指标不存在");
        return value;
    }

    private void requireNoFacts(String tenantId, Long metricId, String errorCode, String message) {
        long facts = metricFactMapper.selectCount(new LambdaQueryWrapper<TaskMetricFact>()
            .eq(TaskMetricFact::getTenantId, tenantId).eq(TaskMetricFact::getMetricId, metricId));
        if (facts > 0) throw conflict(errorCode, message);
    }

    private void requireNoFactsForBinding(String tenantId, Long bindingId, String message) {
        long facts = metricFactMapper.selectCount(new LambdaQueryWrapper<TaskMetricFact>()
            .eq(TaskMetricFact::getTenantId, tenantId).eq(TaskMetricFact::getBindingId, bindingId));
        if (facts > 0) throw conflict("TASK_METRIC_BINDING_IN_USE", message);
    }

    private TaskMetricBinding requireBinding(String tenantId, Long bindingId) {
        TaskMetricBinding value = bindingMapper.selectOne(new LambdaQueryWrapper<TaskMetricBinding>()
            .eq(TaskMetricBinding::getTenantId, tenantId).eq(TaskMetricBinding::getId, bindingId));
        if (value == null) throw new BusinessException(404, "TASK_METRIC_BINDING_NOT_FOUND", "指标绑定不存在");
        return value;
    }

    private BigDecimal conversionFactor(Map<String, Object> conversion) {
        if (conversion == null || conversion.get("factor") == null) return BigDecimal.ONE;
        try {
            BigDecimal factor = new BigDecimal(String.valueOf(conversion.get("factor")));
            if (factor.signum() <= 0) throw new NumberFormatException();
            return factor;
        } catch (NumberFormatException exception) {
            throw BusinessException.badRequest("TASK_METRIC_CONVERSION_INVALID", "单位换算 factor 必须为正数");
        }
    }

    private String text(Object value) { return value == null ? null : String.valueOf(value); }
    private TaskMetricBinding ratioPeer(List<TaskMetricBinding> bindings, TaskMetricBinding binding, String component) {
        return bindings.stream().filter(candidate -> candidate.getMetricId().equals(binding.getMetricId())
                && candidate.getTemplateVersionId().equals(binding.getTemplateVersionId())
                && candidate.getSourceRole().equals(binding.getSourceRole())
                && component.equals(candidate.getRatioComponent())).findFirst().orElse(null);
    }
    private boolean sameSource(TaskFieldFact fact, TaskMetricBinding binding) {
        return binding.getTemplateVersionId().equals(fact.getTemplateVersionId()) && binding.getFieldKey().equals(fact.getFieldKey());
    }
    private String rowKey(TaskFieldFact fact) { return fact.getRowKey() == null ? "" : fact.getRowKey(); }
    private Map<String, Object> copy(Map<String, Object> value) { return value == null ? new LinkedHashMap<>() : new LinkedHashMap<>(value); }
    private BusinessException conflict(String code, String message) { return new BusinessException(409, code, message); }
}
