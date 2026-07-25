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

    @Test
    void normalizesRepeatingTableRowsAndReportsExactInvalidCell() {
        TaskFieldDefinition table = field("weekly_items", "table");
        table.setRequired(true);
        table.setValidation(Map.of(
            "defaultRows", 1, "minRows", 1, "maxRows", 3,
            "columns", List.of(
                Map.of("key", "sequence", "label", "序号", "type", "auto_number", "validation", Map.of("start", 1, "step", 1)),
                Map.of("key", "date", "label", "日期", "type", "date", "required", true),
                Map.of("key", "hours", "label", "工时", "type", "number", "required", true,
                    "validation", Map.of("min", 0, "scale", 1), "summary", "sum"),
                Map.of("key", "status", "label", "状态", "type", "single_select", "required", true,
                    "validation", Map.of("options", List.of(Map.of("value", "done", "label", "完成"))))
            )));

        var valid = runtime.evaluate(List.of(table), Map.of("weekly_items", List.of(
            Map.of("__rowId", "abcdefgh12345678", "sequence", 99, "date", "2026-07-25", "hours", 1.2, "status", "done")
        )));
        var invalid = runtime.evaluate(List.of(table), Map.of("weekly_items", List.of(
            Map.of("__rowId", "abcdefgh87654321", "date", "invalid", "hours", -1, "status", "other")
        )));

        assertThat(invalid.issues()).extracting("path")
            .contains("formData.weekly_items[0].date", "formData.weekly_items[0].hours", "formData.weekly_items[0].status");
        assertThat(((List<?>) valid.values().get("weekly_items")).getFirst())
            .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
            .containsEntry("sequence", 1);
    }

    @Test
    void createsConfiguredDefaultTableRows() {
        TaskFieldDefinition table = field("inspection_items", "table");
        table.setValidation(Map.of("defaultRows", 2, "columns", List.of(
            Map.of("key", "sequence", "label", "序号", "type", "auto_number", "validation", Map.of("start", 10, "step", 5)),
            Map.of("key", "item", "label", "事项", "type", "text")
        )));

        var result = runtime.evaluate(List.of(table), Map.of());

        assertThat(result.issues()).isEmpty();
        assertThat((List<?>) result.values().get("inspection_items")).hasSize(2);
        assertThat(((List<?>) result.values().get("inspection_items")).getFirst())
            .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
            .containsEntry("sequence", 10).containsKey("__rowId");
    }

    @Test
    void acceptsLegacyBrowserFallbackRowId() {
        TaskFieldDefinition table = field("items", "table");
        table.setValidation(Map.of("columns", List.of(
            Map.of("key", "item", "label", "事项", "type", "text")
        )));

        var result = runtime.evaluate(List.of(table), Map.of("items", List.of(
            Map.of("__rowId", "row1784984565266q8k9p1", "item", "完成日志")
        )));

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
