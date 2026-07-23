package com.cwgsyw.platform.module.task.template.form;

import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.dto.TemplateValidationIssue;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class TemplateFormRuntime {
    private final FieldTypeRegistry fieldTypeRegistry;
    private final ExpressionEngine expressionEngine;

    public EvaluationResult evaluate(List<TaskFieldDefinition> fields, Map<String, Object> input) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (input != null) values.putAll(input);
        Map<String, Object> computed = new LinkedHashMap<>();
        Map<String, Boolean> visible = new LinkedHashMap<>();
        Map<String, Boolean> required = new LinkedHashMap<>();
        List<TemplateValidationIssue> issues = new ArrayList<>();

        for (TaskFieldDefinition field : fields) {
            boolean isVisible = evaluateCondition(field, "visibleWhen", true, values, issues);
            boolean isRequired = Boolean.TRUE.equals(field.getRequired())
                || evaluateCondition(field, "requiredWhen", false, values, issues);
            visible.put(field.getKey(), isVisible);
            required.put(field.getKey(), isRequired);
            if (!isVisible) continue;
            Object value = values.containsKey(field.getKey()) ? values.get(field.getKey()) : field.getDefaultValue();
            if (isRequired && isEmpty(value)) {
                issues.add(new TemplateValidationIssue(
                    "FIELD_REQUIRED", field.getKey(), "formData." + field.getKey(), "该字段为必填项"));
                continue;
            }
            if (!isEmpty(value)) {
                FieldValueResult result = fieldTypeRegistry.normalizeAndValidate(
                    field, value, "formData." + field.getKey());
                issues.addAll(result.issues());
                if (result.issues().isEmpty()) values.put(field.getKey(), result.value());
            }
        }

        int remaining = (int) fields.stream().filter(field -> field.getFormula() != null && !field.getFormula().isEmpty()).count();
        int passes = 0;
        while (remaining > 0 && passes++ <= fields.size()) {
            int before = remaining;
            for (TaskFieldDefinition field : fields) {
                if (field.getFormula() == null || field.getFormula().isEmpty() || computed.containsKey(field.getKey())) continue;
                try {
                    Object result = expressionEngine.evaluateFormula(field.getFormula(), values);
                    computed.put(field.getKey(), result);
                    values.put(field.getKey(), result);
                    remaining--;
                } catch (ExpressionException exception) {
                    if (!"FORMULA_VALUE_MISSING".equals(exception.code())) {
                        issues.add(new TemplateValidationIssue(exception.code(), field.getKey(), exception.path(), exception.getMessage()));
                        computed.put(field.getKey(), null);
                        remaining--;
                    }
                }
            }
            if (before == remaining) break;
        }
        if (remaining > 0) {
            issues.add(new TemplateValidationIssue(
                "FORMULA_EVALUATION_UNRESOLVED", null, "formula", "公式依赖值缺失或无法按顺序计算"));
        }
        return new EvaluationResult(
            immutableMap(values), immutableMap(computed), Map.copyOf(visible), Map.copyOf(required), List.copyOf(issues));
    }

    public boolean fieldVisibleForRole(TaskFieldDefinition field, String role) {
        if (Boolean.TRUE.equals(field.getSensitive()) && SetRoles.ANALYTICS_OR_EXPORT.contains(role)) return false;
        Map<String, Object> visibility = field.getVisibility() == null ? Map.of() : field.getVisibility();
        Object access = visibility.get(role);
        if (access instanceof Boolean bool) return bool;
        return access == null || !"hidden".equals(access) && !"none".equals(access);
    }

    @SuppressWarnings("unchecked")
    private boolean evaluateCondition(TaskFieldDefinition field, String key, boolean defaultValue,
                                      Map<String, Object> values, List<TemplateValidationIssue> issues) {
        Map<String, Object> condition = field.getCondition();
        if (condition == null || condition.isEmpty()) return defaultValue;
        Object expression = condition.get(key);
        if (expression == null && "visibleWhen".equals(key) && condition.containsKey("op")) expression = condition;
        if (!(expression instanceof Map<?, ?> rawExpression)) return defaultValue;
        try {
            return expressionEngine.evaluateCondition((Map<String, Object>) rawExpression, values);
        } catch (ExpressionException exception) {
            issues.add(new TemplateValidationIssue(exception.code(), field.getKey(), exception.path(), exception.getMessage()));
            return defaultValue;
        }
    }

    private static boolean isEmpty(Object value) {
        return value == null || value instanceof String string && string.isBlank()
            || value instanceof Collection<?> collection && collection.isEmpty();
    }

    private static <K, V> Map<K, V> immutableMap(Map<K, V> values) {
        return Collections.unmodifiableMap(new LinkedHashMap<>(values));
    }

    public record EvaluationResult(
        Map<String, Object> values,
        Map<String, Object> computedValues,
        Map<String, Boolean> visibleFields,
        Map<String, Boolean> requiredFields,
        List<TemplateValidationIssue> issues
    ) {
    }

    private static final class SetRoles {
        private static final java.util.Set<String> ANALYTICS_OR_EXPORT = java.util.Set.of("analytics", "export");

        private SetRoles() {
        }
    }
}
