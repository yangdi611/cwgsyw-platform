package com.cwgsyw.platform.module.task.template.form;

import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.dto.TemplateValidationIssue;
import com.cwgsyw.platform.module.task.template.dto.TemplateValidationResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class TemplateSchemaValidator {
    private static final Pattern FIELD_KEY = Pattern.compile("^[a-z][a-z0-9_]{0,99}$");
    private static final Set<String> NUMERIC_TYPES = Set.of("number", "money", "percentage", "rating", "duration", "formula", "aggregate_reference");

    private final FieldTypeRegistry fieldTypeRegistry;
    private final ExpressionEngine expressionEngine;

    public TemplateValidationResult validate(List<TaskFieldDefinition> fields) {
        List<TaskFieldDefinition> safeFields = fields == null ? List.of() : fields;
        List<TemplateValidationIssue> issues = new ArrayList<>(fieldTypeRegistry.validateAll(safeFields));
        Map<String, TaskFieldDefinition> byKey = new LinkedHashMap<>();
        Map<String, Set<String>> dependencies = new HashMap<>();
        for (TaskFieldDefinition field : safeFields) {
            if (field.getKey() == null || !FIELD_KEY.matcher(field.getKey()).matches()) {
                issues.add(issue("FIELD_KEY_INVALID", field.getKey(), "key", "字段编码必须是小写字母、数字或下划线"));
                continue;
            }
            if (byKey.putIfAbsent(field.getKey(), field) != null) {
                issues.add(issue("FIELD_KEY_DUPLICATE", field.getKey(), "key", "字段编码重复"));
            }
        }
        for (TaskFieldDefinition field : safeFields) {
            if (field.getKey() == null) continue;
            Set<String> references = new HashSet<>();
            validateCondition(field, byKey, references, issues);
            validateFormula(field, byKey, references, issues);
            dependencies.put(field.getKey(), references);
        }
        detectCycles(dependencies, issues);
        return TemplateValidationResult.of(issues);
    }

    private void validateCondition(TaskFieldDefinition field, Map<String, TaskFieldDefinition> byKey,
                                   Set<String> references, List<TemplateValidationIssue> issues) {
        Map<String, Object> condition = field.getCondition();
        if (condition == null || condition.isEmpty()) return;
        for (Map.Entry<String, Map<String, Object>> entry : conditionExpressions(condition).entrySet()) {
            try {
                expressionEngine.validateCondition(entry.getValue());
                for (String reference : expressionEngine.references(entry.getValue())) {
                    references.add(reference);
                    if (!byKey.containsKey(reference)) {
                        issues.add(issue("FIELD_REFERENCE_MISSING", field.getKey(), "condition." + entry.getKey(), "条件引用的字段不存在: " + reference));
                    }
                }
            } catch (ExpressionException exception) {
                issues.add(issue(exception.code(), field.getKey(), exception.path(), exception.getMessage()));
            }
        }
    }

    private void validateFormula(TaskFieldDefinition field, Map<String, TaskFieldDefinition> byKey,
                                 Set<String> references, List<TemplateValidationIssue> issues) {
        Map<String, Object> formula = field.getFormula();
        if (formula == null || formula.isEmpty()) return;
        if (!NUMERIC_TYPES.contains(field.getType())) {
            issues.add(issue("FORMULA_TARGET_TYPE_INVALID", field.getKey(), "formula", "公式只能写入数值或公式字段"));
        }
        try {
            expressionEngine.validateFormula(formula);
            for (String reference : expressionEngine.references(formula)) {
                references.add(reference);
                TaskFieldDefinition source = byKey.get(reference);
                if (source == null) {
                    issues.add(issue("FIELD_REFERENCE_MISSING", field.getKey(), "formula", "公式引用的字段不存在: " + reference));
                } else if (!NUMERIC_TYPES.contains(source.getType())) {
                    issues.add(issue("FORMULA_SOURCE_TYPE_INVALID", field.getKey(), "formula", "公式引用的字段不是数值类型: " + reference));
                }
            }
        } catch (ExpressionException exception) {
            issues.add(issue(exception.code(), field.getKey(), exception.path(), exception.getMessage()));
        }
    }

    private void detectCycles(Map<String, Set<String>> dependencies, List<TemplateValidationIssue> issues) {
        Set<String> visited = new HashSet<>();
        Set<String> visiting = new HashSet<>();
        for (String field : dependencies.keySet()) detectCycle(field, dependencies, visited, visiting, new ArrayList<>(), issues);
    }

    private void detectCycle(String field, Map<String, Set<String>> dependencies, Set<String> visited,
                             Set<String> visiting, List<String> path, List<TemplateValidationIssue> issues) {
        if (visited.contains(field)) return;
        if (!visiting.add(field)) {
            int start = path.indexOf(field);
            List<String> cycle = start >= 0 ? path.subList(start, path.size()) : path;
            issues.add(issue("FIELD_DEPENDENCY_CYCLE", field, "expression", "字段依赖形成循环: " + String.join(" -> ", cycle) + " -> " + field));
            return;
        }
        path.add(field);
        for (String dependency : dependencies.getOrDefault(field, Set.of())) {
            if (dependencies.containsKey(dependency)) detectCycle(dependency, dependencies, visited, visiting, path, issues);
        }
        path.remove(path.size() - 1);
        visiting.remove(field);
        visited.add(field);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Map<String, Object>> conditionExpressions(Map<String, Object> condition) {
        Map<String, Map<String, Object>> expressions = new LinkedHashMap<>();
        Object visibleWhen = condition.get("visibleWhen");
        Object requiredWhen = condition.get("requiredWhen");
        if (visibleWhen instanceof Map<?, ?> map) expressions.put("visibleWhen", (Map<String, Object>) map);
        if (requiredWhen instanceof Map<?, ?> map) expressions.put("requiredWhen", (Map<String, Object>) map);
        if (expressions.isEmpty() && (condition.containsKey("op") || condition.containsKey("function"))) expressions.put("visibleWhen", condition);
        return expressions;
    }

    private static TemplateValidationIssue issue(String code, String fieldKey, String path, String message) {
        return new TemplateValidationIssue(code, fieldKey, path, message);
    }
}
