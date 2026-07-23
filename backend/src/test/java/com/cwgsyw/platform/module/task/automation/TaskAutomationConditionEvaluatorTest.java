package com.cwgsyw.platform.module.task.automation;

import com.cwgsyw.platform.module.task.automation.entity.TaskAutomationRule;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TaskAutomationConditionEvaluatorTest {
    private final TaskAutomationConditionEvaluator evaluator = new TaskAutomationConditionEvaluator();

    @Test
    void numericThresholdMatchesMetricAndValue() {
        TaskAutomationRule rule = rule(Map.of("metricId", 7L),
            Map.of("field", "metricValue", "operator", "gt", "value", "3"));
        TaskLifecycleEvent event = new TaskLifecycleEvent("tenant-a", "metric_threshold", 1L, 2L,
            LocalDateTime.now(), Map.of("metricFactId", 9L, "metricId", 7L, "metricValue", "4"));

        assertThat(evaluator.matches(rule, event)).isTrue();
    }

    @Test
    void missingValueNeverMatchesOrderingComparison() {
        TaskAutomationRule rule = rule(Map.of(),
            Map.of("field", "ownerGroupId", "operator", "lt", "value", 5L));
        TaskLifecycleEvent event = new TaskLifecycleEvent("tenant-a", "metric_threshold", 1L, 2L,
            LocalDateTime.now(), Map.of("metricFactId", 9L));

        assertThat(evaluator.matches(rule, event)).isFalse();
    }

    @Test
    void eventDropsNullOptionalAttributesWithoutLosingStableSource() {
        Map<String, Object> attributes = new LinkedHashMap<>();
        attributes.put("metricFactId", 9L);
        attributes.put("ownerGroupId", null);

        TaskLifecycleEvent event = new TaskLifecycleEvent("tenant-a", "metric_threshold", 1L, 2L,
            LocalDateTime.now(), attributes);

        assertThat(event.attributes()).containsOnlyKeys("metricFactId");
        assertThat(event.sourceId()).isEqualTo(9L);
    }

    private TaskAutomationRule rule(Map<String, Object> trigger, Map<String, Object> condition) {
        TaskAutomationRule value = new TaskAutomationRule();
        value.setTriggerType("metric_threshold");
        value.setTriggerConfig(trigger);
        value.setConditionConfig(condition);
        return value;
    }
}
