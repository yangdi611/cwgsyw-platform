package com.cwgsyw.platform.module.task.metric;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.task.metric.dto.MetricBindingRequest;
import com.cwgsyw.platform.module.task.metric.dto.MetricDefinitionRequest;
import com.cwgsyw.platform.module.task.metric.dto.MetricPreviewRequest;
import com.cwgsyw.platform.module.task.metric.entity.TaskMetricDefinition;
import com.cwgsyw.platform.module.task.metric.entity.TaskMetricFact;
import com.cwgsyw.platform.module.task.metric.mapper.TaskMetricBindingMapper;
import com.cwgsyw.platform.module.task.metric.mapper.TaskMetricDefinitionMapper;
import com.cwgsyw.platform.module.task.metric.mapper.TaskMetricFactMapper;
import com.cwgsyw.platform.module.task.metric.mapper.TaskMetricGoalMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskFieldFactMapper;
import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateVersionVO;
import com.cwgsyw.platform.module.task.template.service.TaskTemplateService;
import com.cwgsyw.platform.security.SecurityUser;
import org.springframework.context.ApplicationEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskMetricServiceTest {
    @Mock TaskMetricDefinitionMapper definitionMapper;
    @Mock TaskMetricBindingMapper bindingMapper;
    @Mock TaskMetricFactMapper metricFactMapper;
    @Mock TaskMetricGoalMapper goalMapper;
    @Mock TaskFieldFactMapper fieldFactMapper;
    @Mock TaskTemplateService templateService;
    @Mock ApplicationEventPublisher eventPublisher;

    private TaskMetricService service;
    private SecurityUser user;

    @BeforeEach
    void setUp() {
        service = new TaskMetricService(definitionMapper, bindingMapper, metricFactMapper, goalMapper, fieldFactMapper,
            templateService, eventPublisher);
        user = new SecurityUser(7L, "operator", "", "tenant-a", 3L, "group", Set.of("task_analytics:read"));
    }

    @Test
    void requiresUnitConversionWhenFieldAndMetricUnitsDiffer() {
        TaskMetricDefinition metric = metric("number", "sum", "次", Map.of());
        when(definitionMapper.selectOne(any())).thenReturn(metric);
        when(templateService.getVersion("tenant-a", 10L)).thenReturn(version(field("number", "小时")));

        assertThatThrownBy(() -> service.addBinding(user, 1L,
            new MetricBindingRequest(10L, 20L, "fact", null, null, true)))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("TASK_METRIC_UNIT_CONVERSION_REQUIRED"));
    }

    @Test
    void createsValidatedBindingAndBackfillsNumericFacts() {
        TaskMetricDefinition metric = metric("number", "sum", "小时", Map.of());
        when(definitionMapper.selectOne(any())).thenReturn(metric);
        when(templateService.getVersion("tenant-a", 10L)).thenReturn(version(field("number", "分钟")));
        when(fieldFactMapper.selectList(any())).thenReturn(List.of());

        service.addBinding(user, 1L, new MetricBindingRequest(10L, 20L, "fact", null, Map.of("factor", "0.0166666667"), true));

        ArgumentCaptor<com.cwgsyw.platform.module.task.metric.entity.TaskMetricBinding> captor =
            ArgumentCaptor.forClass(com.cwgsyw.platform.module.task.metric.entity.TaskMetricBinding.class);
        verify(bindingMapper).insert(captor.capture());
        assertThat(captor.getValue().getFieldKey()).isEqualTo("inspection_count");
        assertThat(captor.getValue().getUnitConversion()).containsEntry("factor", "0.0166666667");
        assertThat(captor.getValue().getSourceRole()).isEqualTo("fact");
    }

    @Test
    void previewSeparatesSystemAndManualValuesAndReturnsLineage() {
        TaskMetricDefinition metric = metric("number", "sum", "次", Map.of("sourceRole", "fact"));
        when(definitionMapper.selectOne(any())).thenReturn(metric);
        when(metricFactMapper.selectList(any())).thenReturn(List.of(
            fact(1L, 10L, 100L, "fact", "3"),
            fact(2L, 11L, 101L, "fact", "4"),
            fact(3L, 12L, 102L, "manual_report", "5")
        ));

        var result = service.preview(user, 1L,
            new MetricPreviewRequest(LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 7), null));

        assertThat(result.systemValue()).isEqualByComparingTo("7");
        assertThat(result.manualValue()).isEqualByComparingTo("5");
        assertThat(result.difference()).isEqualByComparingTo("-2");
        assertThat(result.selectedSourceRole()).isEqualTo("fact");
        assertThat(result.factIds()).containsExactly(1L, 2L);
        assertThat(result.taskIds()).containsExactly(10L, 11L);
        assertThat(result.submissionIds()).containsExactly(100L, 101L);
    }

    @Test
    void ratioDefinitionRequiresRatioAggregation() {
        MetricDefinitionRequest request = new MetricDefinitionRequest("pass_rate", "通过率", null,
            "ratio", "%", 4, "avg", "non_additive", Map.of(), Map.of());

        assertThatThrownBy(() -> service.create(user, request))
            .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("TASK_METRIC_RATIO_AGGREGATION_REQUIRED"));
    }

    @Test
    void ratioBindingRequiresAnExplicitComponent() {
        TaskMetricDefinition metric = metric("ratio", "ratio", "%", Map.of());
        when(definitionMapper.selectOne(any())).thenReturn(metric);
        when(templateService.getVersion("tenant-a", 10L)).thenReturn(version(field("number", "次")));

        assertThatThrownBy(() -> service.addBinding(user, 1L,
            new MetricBindingRequest(10L, 20L, "fact", null, null, true)))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("TASK_METRIC_RATIO_COMPONENT_REQUIRED"));
    }

    @Test
    void syncsPairedRatioFactsWithOperandLineage() {
        var numerator = fieldFact(30L, "passed", "8");
        var denominator = fieldFact(31L, "checked", "10");
        var numeratorBinding = ratioBinding(40L, "passed", "numerator");
        var denominatorBinding = ratioBinding(41L, "checked", "denominator");
        when(fieldFactMapper.selectList(any())).thenReturn(List.of(numerator, denominator));
        when(bindingMapper.selectList(any())).thenReturn(List.of(numeratorBinding, denominatorBinding));
        when(metricFactMapper.selectCount(any())).thenReturn(0L);
        when(definitionMapper.selectOne(any())).thenReturn(metric("ratio", "ratio", "%", Map.of()));

        service.syncSubmission("tenant-a", 100L, true);

        ArgumentCaptor<TaskMetricFact> fact = ArgumentCaptor.forClass(TaskMetricFact.class);
        verify(metricFactMapper).insert(fact.capture());
        assertThat(fact.getValue().getBindingId()).isEqualTo(40L);
        assertThat(fact.getValue().getFieldFactId()).isEqualTo(30L);
        assertThat(fact.getValue().getDenominatorFieldFactId()).isEqualTo(31L);
        assertThat(fact.getValue().getNumerator()).isEqualByComparingTo("8");
        assertThat(fact.getValue().getDenominator()).isEqualByComparingTo("10");
        assertThat(fact.getValue().getValue()).isEqualByComparingTo("0.8000");
    }

    @Test
    void previewUsesSummedRatioOperandsInsteadOfAveragingRates() {
        TaskMetricDefinition metric = metric("ratio", "ratio", "%", Map.of("sourceRole", "fact"));
        TaskMetricFact first = fact(1L, 10L, 100L, "fact", "0.5");
        first.setNumerator(new BigDecimal("1")); first.setDenominator(new BigDecimal("2"));
        TaskMetricFact second = fact(2L, 11L, 101L, "fact", "1");
        second.setNumerator(new BigDecimal("9")); second.setDenominator(new BigDecimal("9"));
        when(definitionMapper.selectOne(any())).thenReturn(metric);
        when(metricFactMapper.selectList(any())).thenReturn(List.of(first, second));

        var result = service.preview(user, 1L,
            new MetricPreviewRequest(LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 7), null));

        assertThat(result.systemValue()).isEqualByComparingTo("0.9091");
    }

    @Test
    void preventsDefinitionMutationWhenFormalFactsExist() {
        TaskMetricDefinition metric = metric("number", "sum", "次", Map.of("sourceRole", "fact"));
        when(definitionMapper.selectOne(any())).thenReturn(metric);
        when(definitionMapper.selectCount(any())).thenReturn(0L);
        when(metricFactMapper.selectCount(any())).thenReturn(1L);

        assertThatThrownBy(() -> service.update(user, 1L, new MetricDefinitionRequest("inspection_count", "巡检总次数", null,
            "number", "次", 4, "sum", "additive", Map.of(), Map.of("sourceRole", "fact"))))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode()).isEqualTo("TASK_METRIC_IN_USE"));
        verify(definitionMapper, never()).updateById(any(TaskMetricDefinition.class));
    }

    @Test
    void physicallyDeletesUnusedDefinitionAfterRemovingBindings() {
        TaskMetricDefinition metric = metric("number", "sum", "次", Map.of());
        when(definitionMapper.selectOne(any())).thenReturn(metric);
        when(metricFactMapper.selectCount(any())).thenReturn(0L);
        when(goalMapper.selectCount(any())).thenReturn(0L);

        service.delete(user, 1L);

        verify(bindingMapper).delete(any());
        verify(definitionMapper).deleteById(1L);
    }

    @Test
    void preventsBindingDeletionWhenFormalFactsExist() {
        var binding = new com.cwgsyw.platform.module.task.metric.entity.TaskMetricBinding();
        binding.setId(40L); binding.setTenantId("tenant-a");
        when(bindingMapper.selectOne(any())).thenReturn(binding);
        when(metricFactMapper.selectCount(any())).thenReturn(1L);

        assertThatThrownBy(() -> service.deleteBinding(user, 40L))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode()).isEqualTo("TASK_METRIC_BINDING_IN_USE"));
        verify(bindingMapper, never()).deleteById(40L);
    }

    @Test
    void activeSubmissionPublishesMetricThresholdOnlyForNewEffectiveFact() {
        var fieldFact = new com.cwgsyw.platform.module.task.runtime.entity.TaskFieldFact();
        fieldFact.setId(30L); fieldFact.setTenantId("tenant-a"); fieldFact.setSubmissionId(100L);
        fieldFact.setTaskId(10L); fieldFact.setTemplateVersionId(10L); fieldFact.setFieldKey("inspection_count");
        fieldFact.setValueNumber(new BigDecimal("3")); fieldFact.setBusinessDate(LocalDate.of(2026, 7, 23));
        var binding = new com.cwgsyw.platform.module.task.metric.entity.TaskMetricBinding();
        binding.setId(40L); binding.setTenantId("tenant-a"); binding.setMetricId(1L);
        binding.setTemplateVersionId(10L); binding.setFieldKey("inspection_count");
        binding.setSourceRole("fact"); binding.setUnitConversion(Map.of()); binding.setEnabled(true);
        when(fieldFactMapper.selectList(any())).thenReturn(List.of(fieldFact));
        when(bindingMapper.selectList(any())).thenReturn(List.of(binding));
        when(metricFactMapper.selectCount(any())).thenReturn(0L);
        doAnswer(invocation -> {
            TaskMetricFact value = invocation.getArgument(0);
            value.setId(77L);
            return 1;
        }).when(metricFactMapper).insert(any(TaskMetricFact.class));

        service.syncSubmission("tenant-a", 100L, true);

        ArgumentCaptor<com.cwgsyw.platform.module.task.automation.TaskLifecycleEvent> event =
            ArgumentCaptor.forClass(com.cwgsyw.platform.module.task.automation.TaskLifecycleEvent.class);
        verify(eventPublisher).publishEvent(event.capture());
        assertThat(event.getValue().eventType()).isEqualTo("metric_threshold");
        assertThat(event.getValue().sourceType()).isEqualTo("metric_fact");
        assertThat(event.getValue().sourceId()).isEqualTo(77L);
        assertThat(event.getValue().attributes()).containsEntry("metricId", 1L)
            .containsEntry("metricValue", new BigDecimal("3"));
    }

    @Test
    void pendingSubmissionDoesNotPublishMetricThreshold() {
        var fieldFact = new com.cwgsyw.platform.module.task.runtime.entity.TaskFieldFact();
        fieldFact.setId(30L); fieldFact.setTenantId("tenant-a"); fieldFact.setSubmissionId(100L);
        fieldFact.setTaskId(10L); fieldFact.setTemplateVersionId(10L); fieldFact.setFieldKey("inspection_count");
        fieldFact.setValueNumber(new BigDecimal("3"));
        var binding = new com.cwgsyw.platform.module.task.metric.entity.TaskMetricBinding();
        binding.setId(40L); binding.setTenantId("tenant-a"); binding.setMetricId(1L);
        binding.setTemplateVersionId(10L); binding.setFieldKey("inspection_count");
        binding.setSourceRole("fact"); binding.setUnitConversion(Map.of()); binding.setEnabled(true);
        when(fieldFactMapper.selectList(any())).thenReturn(List.of(fieldFact));
        when(bindingMapper.selectList(any())).thenReturn(List.of(binding));
        when(metricFactMapper.selectCount(any())).thenReturn(0L);

        service.syncSubmission("tenant-a", 100L, false);

        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void approvalActivationPublishesOnlyNewlyEffectiveFacts() {
        TaskMetricFact activated = fact(77L, 10L, 100L, "fact", "4");
        activated.setCreatedAt(LocalDateTime.of(2026, 7, 23, 10, 0));
        when(metricFactMapper.activateSubmissionFacts(eq("tenant-a"), eq(100L), any()))
            .thenReturn(List.of(activated));

        service.activateSubmission("tenant-a", 10L, 100L, LocalDateTime.of(2026, 7, 23, 11, 0));

        verify(eventPublisher).publishEvent(any(com.cwgsyw.platform.module.task.automation.TaskLifecycleEvent.class));
    }

    private TaskMetricDefinition metric(String valueType, String aggregation, String unit, Map<String, Object> policy) {
        TaskMetricDefinition metric = new TaskMetricDefinition();
        metric.setId(1L); metric.setTenantId("tenant-a"); metric.setCode("inspection_count");
        metric.setName("巡检次数"); metric.setValueType(valueType);
        metric.setAggregation(aggregation); metric.setAdditivity("additive"); metric.setUnit(unit);
        metric.setScale(4); metric.setAuthorityPolicy(policy);
        return metric;
    }

    private TaskFieldDefinition field(String type, String unit) {
        TaskFieldDefinition field = new TaskFieldDefinition();
        field.setId(20L); field.setKey("inspection_count"); field.setLabel("巡检次数"); field.setType(type);
        field.setSensitive(false); field.setAnalytics(Map.of("enabled", true, "unit", unit));
        return field;
    }

    private com.cwgsyw.platform.module.task.runtime.entity.TaskFieldFact fieldFact(Long id, String key, String value) {
        var fact = new com.cwgsyw.platform.module.task.runtime.entity.TaskFieldFact();
        fact.setId(id); fact.setTenantId("tenant-a"); fact.setSubmissionId(100L); fact.setTaskId(10L);
        fact.setTemplateVersionId(10L); fact.setFieldKey(key); fact.setValueNumber(new BigDecimal(value));
        fact.setBusinessDate(LocalDate.of(2026, 7, 23)); fact.setIsActive(true);
        return fact;
    }

    private com.cwgsyw.platform.module.task.metric.entity.TaskMetricBinding ratioBinding(Long id, String fieldKey,
                                                                                            String component) {
        var binding = new com.cwgsyw.platform.module.task.metric.entity.TaskMetricBinding();
        binding.setId(id); binding.setTenantId("tenant-a"); binding.setMetricId(1L); binding.setTemplateVersionId(10L);
        binding.setFieldKey(fieldKey); binding.setSourceRole("fact"); binding.setRatioComponent(component);
        binding.setUnitConversion(Map.of()); binding.setEnabled(true);
        return binding;
    }

    private TaskTemplateVersionVO version(TaskFieldDefinition field) {
        return TaskTemplateVersionVO.builder().id(10L).templateId(9L).status("published")
            .name("日报").fields(List.of(field)).build();
    }

    private TaskMetricFact fact(Long id, Long taskId, Long submissionId, String source, String value) {
        TaskMetricFact fact = new TaskMetricFact();
        fact.setId(id); fact.setTenantId("tenant-a"); fact.setMetricId(1L); fact.setTaskId(taskId);
        fact.setSubmissionId(submissionId); fact.setSourceType(source); fact.setValue(new BigDecimal(value));
        fact.setBusinessDate(LocalDate.of(2026, 7, 2)); fact.setEffective(true);
        return fact;
    }
}
