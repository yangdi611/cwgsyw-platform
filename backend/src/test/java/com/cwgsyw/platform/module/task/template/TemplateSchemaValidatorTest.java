package com.cwgsyw.platform.module.task.template;

import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.form.ExpressionEngine;
import com.cwgsyw.platform.module.task.template.form.FieldTypeRegistry;
import com.cwgsyw.platform.module.task.template.form.TemplateSchemaValidator;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TemplateSchemaValidatorTest {
    private final TemplateSchemaValidator validator = new TemplateSchemaValidator(
        new FieldTypeRegistry(), new ExpressionEngine());

    @Test
    void acceptsInspectionTemplateWithConditionAndFormula() {
        TaskFieldDefinition exception = field("has_exception", "boolean");
        TaskFieldDefinition detail = field("exception_detail", "textarea");
        detail.setCondition(Map.of(
            "visibleWhen", eq("has_exception", true),
            "requiredWhen", eq("has_exception", true)));
        TaskFieldDefinition normal = field("normal_count", "number");
        TaskFieldDefinition total = field("total_count", "number");
        TaskFieldDefinition rate = field("pass_rate", "formula");
        rate.setFormula(Map.of("op", "DIVIDE", "args", List.of(
            Map.of("field", "normal_count"), Map.of("field", "total_count"))));

        assertThat(validator.validate(List.of(exception, detail, normal, total, rate)).valid()).isTrue();
    }

    @Test
    void rejectsMissingReferenceAndCycle() {
        TaskFieldDefinition first = field("first", "formula");
        first.setFormula(Map.of("op", "ADD", "args", List.of(Map.of("field", "second"))));
        TaskFieldDefinition second = field("second", "formula");
        second.setFormula(Map.of("op", "ADD", "args", List.of(Map.of("field", "first"))));
        TaskFieldDefinition missing = field("missing_target", "formula");
        missing.setFormula(Map.of("op", "ADD", "args", List.of(Map.of("field", "unknown"))));

        var result = validator.validate(List.of(first, second, missing));

        assertThat(result.valid()).isFalse();
        assertThat(result.issues()).extracting("code")
            .contains("FIELD_DEPENDENCY_CYCLE", "FIELD_REFERENCE_MISSING");
    }

    private Map<String, Object> eq(String field, Object value) {
        return Map.of("op", "eq", "left", Map.of("field", field), "right", Map.of("literal", value));
    }

    private TaskFieldDefinition field(String key, String type) {
        TaskFieldDefinition field = new TaskFieldDefinition();
        field.setKey(key);
        field.setLabel(key);
        field.setType(type);
        return field;
    }
}
