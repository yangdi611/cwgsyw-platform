package com.cwgsyw.platform.module.task.template;

import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.form.ExpressionEngine;
import com.cwgsyw.platform.module.task.template.form.FieldTypeRegistry;
import com.cwgsyw.platform.module.task.template.form.TemplateFormRuntime;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TemplateFormRuntimeTest {
    private final TemplateFormRuntime runtime = new TemplateFormRuntime(
        new FieldTypeRegistry(), new ExpressionEngine());

    @Test
    void appliesConditionalVisibilityRequiredAndFormula() {
        TaskFieldDefinition exception = field("has_exception", "boolean");
        TaskFieldDefinition detail = field("detail", "textarea");
        Map<String, Object> condition = Map.of(
            "op", "eq", "left", Map.of("field", "has_exception"), "right", Map.of("literal", true));
        detail.setCondition(Map.of("visibleWhen", condition, "requiredWhen", condition));
        TaskFieldDefinition total = field("total", "number");
        TaskFieldDefinition doubled = field("doubled", "formula");
        doubled.setFormula(Map.of("op", "MULTIPLY", "args", List.of(
            Map.of("field", "total"), Map.of("literal", 2))));

        var result = runtime.evaluate(List.of(exception, detail, total, doubled),
            Map.of("has_exception", true, "total", 3));

        assertThat(result.visibleFields().get("detail")).isTrue();
        assertThat(result.requiredFields().get("detail")).isTrue();
        assertThat(result.issues()).extracting("code").contains("FIELD_REQUIRED");
        assertThat(result.computedValues().get("doubled")).isEqualTo(new BigDecimal("6"));
    }

    @Test
    void hidesSensitiveFieldFromAnalyticsAndExport() {
        TaskFieldDefinition field = field("secret", "text");
        field.setSensitive(true);

        assertThat(runtime.fieldVisibleForRole(field, "executor")).isTrue();
        assertThat(runtime.fieldVisibleForRole(field, "analytics")).isFalse();
        assertThat(runtime.fieldVisibleForRole(field, "export")).isFalse();
    }

    @Test
    void keepsConfiguredNullResultForDivideByZero() {
        TaskFieldDefinition numerator = field("numerator", "number");
        TaskFieldDefinition denominator = field("denominator", "number");
        TaskFieldDefinition rate = field("rate", "formula");
        rate.setFormula(Map.of(
            "op", "DIVIDE",
            "onDivideByZero", "null",
            "args", List.of(Map.of("field", "numerator"), Map.of("field", "denominator"))));

        var result = runtime.evaluate(List.of(numerator, denominator, rate),
            Map.of("numerator", 10, "denominator", 0));

        assertThat(result.computedValues()).containsEntry("rate", null);
        assertThat(result.issues()).isEmpty();
    }

    private TaskFieldDefinition field(String key, String type) {
        TaskFieldDefinition field = new TaskFieldDefinition();
        field.setKey(key);
        field.setLabel(key);
        field.setType(type);
        return field;
    }
}
