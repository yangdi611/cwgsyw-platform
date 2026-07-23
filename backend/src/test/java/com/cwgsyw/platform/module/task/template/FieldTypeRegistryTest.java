package com.cwgsyw.platform.module.task.template;

import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.form.FieldTypeRegistry;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class FieldTypeRegistryTest {
    private final FieldTypeRegistry registry = new FieldTypeRegistry();

    @Test
    void exposesAllRequiredTypesAndLegalAggregations() {
        assertThat(registry.metadata()).extracting("type").contains(
            "text", "textarea", "rich_text", "number", "money", "percentage",
            "single_select", "multi_select", "boolean", "rating", "tags", "date",
            "datetime", "date_range", "duration", "user", "group", "role", "ci_scope",
            "relation", "table", "repeater", "file", "image", "formula",
            "aggregate_reference", "section", "help_text");
        assertThat(registry.metadata().stream().filter(type -> type.type().equals("number")).findFirst().orElseThrow().aggregations())
            .contains("sum", "avg", "min", "max");
    }

    @Test
    void validatesNumericRangeScaleAndSelectionOptions() {
        TaskFieldDefinition number = field("count", "number");
        number.setValidation(Map.of("min", 0, "max", 10, "scale", 0));
        assertThat(registry.validateConfiguration(number)).isEmpty();
        assertThat(registry.normalizeAndValidate(number, 8, "formData.count").value()).isEqualTo(new BigDecimal("8"));
        assertThat(registry.normalizeAndValidate(number, 11, "formData.count").issues())
            .singleElement().extracting("path").isEqualTo("formData.count");

        TaskFieldDefinition select = field("result", "single_select");
        select.setValidation(Map.of("options", List.of(Map.of("value", "normal", "label", "正常"))));
        assertThat(registry.validateConfiguration(select)).isEmpty();
        assertThat(registry.normalizeAndValidate(select, "abnormal", "formData.result").issues()).hasSize(1);
    }

    @Test
    void locatesTableErrorsAtRowAndColumn() {
        TaskFieldDefinition table = field("checks", "table");
        table.setValidation(Map.of("columns", List.of(
            Map.of("key", "name", "type", "text", "required", true),
            Map.of("key", "count", "type", "number", "required", false))));

        var result = registry.normalizeAndValidate(table, List.of(Map.of("count", 2)), "formData.checks");

        assertThat(result.issues()).singleElement().satisfies(issue -> {
            assertThat(issue.fieldKey()).isEqualTo("checks");
            assertThat(issue.path()).isEqualTo("formData.checks[0].name");
        });
    }

    @Test
    void rejectsSensitiveAnalyticsOrExport() {
        TaskFieldDefinition sensitive = field("secret", "text");
        sensitive.setSensitive(true);
        sensitive.setVisibility(Map.of("export", true));
        sensitive.setAnalytics(Map.of("enabled", true, "aggregation", "count"));

        assertThat(registry.validateConfiguration(sensitive)).extracting("code")
            .contains("SENSITIVE_FIELD_EXPOSURE");
    }

    @Test
    void aggregateReferenceRequiresMetricAndFixedTimeWindow() {
        TaskFieldDefinition aggregate = field("weekly_total", "aggregate_reference");
        assertThat(registry.validateConfiguration(aggregate)).extracting("path")
            .contains("validation.aggregate");

        aggregate.setValidation(Map.of("aggregate", Map.of("metricId", 7, "from", "2026-07-08", "to", "2026-07-01")));
        assertThat(registry.validateConfiguration(aggregate)).extracting("path")
            .contains("validation.aggregate");

        aggregate.setValidation(Map.of("aggregate", Map.of("metricId", 7, "from", "2026-07-01", "to", "2026-07-07")));
        assertThat(registry.validateConfiguration(aggregate)).isEmpty();
        assertThat(registry.normalizeAndValidate(aggregate, "42.50", "formData.weekly_total").value())
            .isEqualTo(new BigDecimal("42.50"));
    }

    private TaskFieldDefinition field(String key, String type) {
        TaskFieldDefinition field = new TaskFieldDefinition();
        field.setKey(key);
        field.setLabel(key);
        field.setType(type);
        return field;
    }
}
