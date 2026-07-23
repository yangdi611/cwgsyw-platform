package com.cwgsyw.platform.module.task.automation;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.task.automation.entity.TaskAutomationRule;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Component
public class TaskAutomationConditionEvaluator {
    private static final Set<String> OPERATORS = Set.of("eq", "ne", "gt", "gte", "lt", "lte");

    public boolean matches(TaskAutomationRule rule, TaskLifecycleEvent event) {
        Map<String, Object> trigger = values(rule.getTriggerConfig());
        if ("metric_threshold".equals(rule.getTriggerType()) && trigger.get("metricId") != null
                && !equivalent(trigger.get("metricId"), event.attributes().get("metricId"))) {
            return false;
        }
        Map<String, Object> condition = values(rule.getConditionConfig());
        if (condition.isEmpty()) return true;
        validate(rule);
        Object actual = eventValue(event, String.valueOf(condition.get("field")));
        Object expected = condition.get("value");
        String operator = String.valueOf(condition.get("operator"));
        if (actual == null || expected == null) {
            return "eq".equals(operator) && Objects.equals(actual, expected)
                || "ne".equals(operator) && !Objects.equals(actual, expected);
        }
        return switch (operator) {
            case "eq" -> equivalent(actual, expected);
            case "ne" -> !equivalent(actual, expected);
            case "gt" -> compare(actual, expected) > 0;
            case "gte" -> compare(actual, expected) >= 0;
            case "lt" -> compare(actual, expected) < 0;
            case "lte" -> compare(actual, expected) <= 0;
            default -> false;
        };
    }

    public void validate(TaskAutomationRule rule) {
        Map<String, Object> condition = values(rule.getConditionConfig());
        if (condition.isEmpty()) return;
        String field = condition.get("field") == null ? null : String.valueOf(condition.get("field"));
        String operator = condition.get("operator") == null ? null : String.valueOf(condition.get("operator"));
        if (field == null || !OPERATORS.contains(operator) || !condition.containsKey("value")) {
            throw BusinessException.badRequest("TASK_AUTOMATION_CONDITION_INVALID", "自动化条件必须包含合法的 field、operator 和 value");
        }
    }

    private Object eventValue(TaskLifecycleEvent event, String field) {
        return switch (field) {
            case "taskId" -> event.taskId();
            case "submissionId" -> event.submissionId();
            default -> event.attributes().get(field);
        };
    }

    private boolean equivalent(Object left, Object right) {
        if (left == null || right == null) return Objects.equals(left, right);
        try { return decimal(left).compareTo(decimal(right)) == 0; }
        catch (NumberFormatException ignored) { return String.valueOf(left).equals(String.valueOf(right)); }
    }

    private int compare(Object left, Object right) {
        try { return decimal(left).compareTo(decimal(right)); }
        catch (NumberFormatException ignored) { return String.valueOf(left).compareTo(String.valueOf(right)); }
    }

    private BigDecimal decimal(Object value) { return new BigDecimal(String.valueOf(value)); }
    private Map<String, Object> values(Map<String, Object> value) { return value == null ? Map.of() : value; }
}
