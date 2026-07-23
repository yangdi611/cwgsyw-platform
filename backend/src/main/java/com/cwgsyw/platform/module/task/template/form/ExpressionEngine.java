package com.cwgsyw.platform.module.task.template.form;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Component
public class ExpressionEngine {
    private static final int MAX_DEPTH = 20;
    private static final int MAX_NODES = 200;
    private static final Set<String> CONDITION_OPERATORS = Set.of(
        "eq", "ne", "gt", "gte", "lt", "lte", "in", "not_in", "contains",
        "is_empty", "not_empty", "and", "or", "not");
    private static final Set<String> FORMULA_OPERATORS = Set.of(
        "ADD", "SUBTRACT", "MULTIPLY", "DIVIDE", "SUM", "AVG", "MIN", "MAX",
        "COUNT", "ROUND", "COALESCE");

    public Set<String> references(Map<String, Object> expression) {
        Set<String> references = new LinkedHashSet<>();
        walk(expression, "expression", 0, new int[]{0}, node -> {
            Object field = node.get("field");
            if (field != null) references.add(String.valueOf(field));
        });
        return Set.copyOf(references);
    }

    public void validateCondition(Map<String, Object> expression) {
        walk(expression, "condition", 0, new int[]{0}, node -> {
            if (node.containsKey("field") || node.containsKey("literal")) return;
            String operator = operator(node);
            if (!CONDITION_OPERATORS.contains(operator)) {
                throw new ExpressionException("CONDITION_OPERATOR_INVALID", "condition.op", "不支持的条件操作: " + operator);
            }
            validateOperands(node, operator, "condition");
        });
    }

    public boolean evaluateCondition(Map<String, Object> expression, Map<String, Object> values) {
        validateCondition(expression);
        return truthy(evaluateConditionNode(expression, values));
    }

    public void validateFormula(Map<String, Object> expression) {
        walk(expression, "formula", 0, new int[]{0}, node -> {
            if (node.containsKey("field") || node.containsKey("literal")) return;
            String operator = operator(node).toUpperCase();
            if (!FORMULA_OPERATORS.contains(operator)) {
                throw new ExpressionException("FORMULA_OPERATOR_INVALID", "formula.op", "不支持的公式操作: " + operator);
            }
            validateOperands(node, operator, "formula");
        });
    }

    public Object evaluateFormula(Map<String, Object> expression, Map<String, Object> values) {
        validateFormula(expression);
        return evaluateFormulaNode(expression, values);
    }

    private Object evaluateConditionNode(Object rawNode, Map<String, Object> values) {
        if (!(rawNode instanceof Map<?, ?> rawMap)) return rawNode;
        Map<String, Object> node = castMap(rawMap);
        if (node.containsKey("field")) return values.get(String.valueOf(node.get("field")));
        if (node.containsKey("literal")) return node.get("literal");
        String operator = operator(node);
        List<Object> arguments = arguments(node);
        return switch (operator) {
            case "eq" -> Objects.equals(normalizeComparable(evaluateConditionNode(arguments.get(0), values)),
                normalizeComparable(evaluateConditionNode(arguments.get(1), values)));
            case "ne" -> !Objects.equals(normalizeComparable(evaluateConditionNode(arguments.get(0), values)),
                normalizeComparable(evaluateConditionNode(arguments.get(1), values)));
            case "gt" -> compare(arguments, values) > 0;
            case "gte" -> compare(arguments, values) >= 0;
            case "lt" -> compare(arguments, values) < 0;
            case "lte" -> compare(arguments, values) <= 0;
            case "in", "not_in" -> {
                Object item = evaluateConditionNode(arguments.get(0), values);
                Object set = evaluateConditionNode(arguments.get(1), values);
                boolean contains = set instanceof Collection<?> collection && collection.contains(item);
                yield "in".equals(operator) ? contains : !contains;
            }
            case "contains" -> {
                Object container = evaluateConditionNode(arguments.get(0), values);
                Object item = evaluateConditionNode(arguments.get(1), values);
                yield container instanceof Collection<?> collection && collection.contains(item)
                    || container instanceof String string && string.contains(String.valueOf(item));
            }
            case "is_empty" -> isEmpty(evaluateConditionNode(arguments.get(0), values));
            case "not_empty" -> !isEmpty(evaluateConditionNode(arguments.get(0), values));
            case "and" -> arguments.stream().allMatch(argument -> truthy(evaluateConditionNode(argument, values)));
            case "or" -> arguments.stream().anyMatch(argument -> truthy(evaluateConditionNode(argument, values)));
            case "not" -> !truthy(evaluateConditionNode(arguments.get(0), values));
            default -> throw new ExpressionException("CONDITION_OPERATOR_INVALID", "condition.op", "不支持的条件操作: " + operator);
        };
    }

    private Object evaluateFormulaNode(Object rawNode, Map<String, Object> values) {
        if (!(rawNode instanceof Map<?, ?> rawMap)) return rawNode;
        Map<String, Object> node = castMap(rawMap);
        if (node.containsKey("field")) return values.get(String.valueOf(node.get("field")));
        if (node.containsKey("literal")) return node.get("literal");
        String operator = operator(node).toUpperCase();
        List<Object> arguments = arguments(node).stream()
            .map(argument -> evaluateFormulaNode(argument, values))
            .toList();
        return switch (operator) {
            case "ADD", "SUM" -> numbers(arguments).stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            case "SUBTRACT" -> number(arguments.get(0)).subtract(number(arguments.get(1)));
            case "MULTIPLY" -> numbers(arguments).stream().reduce(BigDecimal.ONE, BigDecimal::multiply);
            case "DIVIDE" -> divide(node, arguments);
            case "AVG" -> average(arguments);
            case "MIN" -> numbers(arguments).stream().min(BigDecimal::compareTo).orElse(null);
            case "MAX" -> numbers(arguments).stream().max(BigDecimal::compareTo).orElse(null);
            case "COUNT" -> count(arguments);
            case "ROUND" -> number(arguments.get(0)).setScale(integer(arguments.get(1)), roundingMode(node));
            case "COALESCE" -> arguments.stream().filter(Objects::nonNull).findFirst().orElse(null);
            default -> throw new ExpressionException("FORMULA_OPERATOR_INVALID", "formula.op", "不支持的公式操作: " + operator);
        };
    }

    private Object divide(Map<String, Object> node, List<Object> arguments) {
        BigDecimal divisor = number(arguments.get(1));
        if (divisor.compareTo(BigDecimal.ZERO) == 0) {
            if ("null".equals(String.valueOf(node.getOrDefault("onDivideByZero", "error")))) return null;
            throw new ExpressionException("FORMULA_DIVIDE_BY_ZERO", "formula", "公式除数不能为零");
        }
        int scale = integer(node.getOrDefault("scale", 6));
        return number(arguments.get(0)).divide(divisor, scale, roundingMode(node));
    }

    private BigDecimal average(List<Object> arguments) {
        List<BigDecimal> numbers = numbers(arguments);
        if (numbers.isEmpty()) return null;
        return numbers.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(numbers.size()), 6, RoundingMode.HALF_UP);
    }

    private long count(List<Object> arguments) {
        if (arguments.size() == 1 && arguments.get(0) instanceof Collection<?> collection) return collection.size();
        return arguments.stream().filter(Objects::nonNull).count();
    }

    private List<BigDecimal> numbers(List<Object> arguments) {
        List<BigDecimal> result = new ArrayList<>();
        for (Object argument : arguments) {
            if (argument instanceof Collection<?> collection) {
                for (Object item : collection) if (item != null) result.add(number(item));
            } else if (argument != null) {
                result.add(number(argument));
            }
        }
        return result;
    }

    private int compare(List<Object> arguments, Map<String, Object> values) {
        Object left = evaluateConditionNode(arguments.get(0), values);
        Object right = evaluateConditionNode(arguments.get(1), values);
        if (left == null || right == null) return left == right ? 0 : left == null ? -1 : 1;
        if (isNumeric(left) && isNumeric(right)) return number(left).compareTo(number(right));
        return String.valueOf(left).compareTo(String.valueOf(right));
    }

    private void walk(Object rawNode, String path, int depth, int[] count, java.util.function.Consumer<Map<String, Object>> visitor) {
        if (rawNode == null) return;
        if (depth > MAX_DEPTH) throw new ExpressionException("EXPRESSION_TOO_DEEP", path, "表达式嵌套超过 " + MAX_DEPTH + " 层");
        if (++count[0] > MAX_NODES) throw new ExpressionException("EXPRESSION_TOO_COMPLEX", path, "表达式节点超过 " + MAX_NODES + " 个");
        if (!(rawNode instanceof Map<?, ?> rawMap)) return;
        Map<String, Object> node = castMap(rawMap);
        visitor.accept(node);
        int index = 0;
        for (Object argument : arguments(node)) {
            walk(argument, path + ".args[" + index++ + "]", depth + 1, count, visitor);
        }
    }

    private static void validateOperands(Map<String, Object> node, String operator, String path) {
        int size = arguments(node).size();
        int minimum = Set.of("and", "or", "ADD", "MULTIPLY", "SUM", "AVG", "MIN", "MAX", "COUNT", "COALESCE").contains(operator) ? 1 : 2;
        int maximum = Set.of("not", "is_empty", "not_empty").contains(operator) ? 1 : minimum == 2 ? 2 : Integer.MAX_VALUE;
        if (size < minimum || size > maximum) {
            throw new ExpressionException("EXPRESSION_ARGUMENT_COUNT_INVALID", path + ".args", "操作 " + operator + " 的参数数量不正确");
        }
    }

    private static List<Object> arguments(Map<String, Object> node) {
        Object args = node.get("args");
        if (args instanceof Collection<?> collection) return new ArrayList<>(collection);
        List<Object> result = new ArrayList<>();
        if (node.containsKey("left")) result.add(node.get("left"));
        if (node.containsKey("right")) result.add(node.get("right"));
        if (node.containsKey("value")) result.add(node.get("value"));
        return result;
    }

    private static String operator(Map<String, Object> node) {
        Object value = node.get("op");
        if (value == null) value = node.get("function");
        return value == null ? "" : String.valueOf(value);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Map<?, ?> value) {
        return (Map<String, Object>) value;
    }

    private static Object normalizeComparable(Object value) {
        return isNumeric(value) ? number(value).stripTrailingZeros() : value;
    }

    private static boolean truthy(Object value) {
        return value instanceof Boolean bool ? bool : value != null && !isEmpty(value);
    }

    private static boolean isEmpty(Object value) {
        return value == null || value instanceof String string && string.isBlank()
            || value instanceof Collection<?> collection && collection.isEmpty()
            || value instanceof Map<?, ?> map && map.isEmpty();
    }

    private static boolean isNumeric(Object value) {
        if (value instanceof Number) return true;
        if (!(value instanceof String string)) return false;
        try {
            new BigDecimal(string);
            return true;
        } catch (NumberFormatException exception) {
            return false;
        }
    }

    private static BigDecimal number(Object value) {
        if (value == null) throw new ExpressionException("FORMULA_VALUE_MISSING", "formula", "公式引用值为空");
        try {
            return value instanceof BigDecimal decimal ? decimal : new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException exception) {
            throw new ExpressionException("FORMULA_TYPE_INVALID", "formula", "公式需要数字值");
        }
    }

    private static int integer(Object value) {
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException exception) {
            throw new ExpressionException("FORMULA_TYPE_INVALID", "formula", "公式精度必须是整数");
        }
    }

    private static RoundingMode roundingMode(Map<String, Object> node) {
        try {
            return RoundingMode.valueOf(String.valueOf(node.getOrDefault("rounding", "HALF_UP")).toUpperCase());
        } catch (IllegalArgumentException exception) {
            throw new ExpressionException("FORMULA_ROUNDING_INVALID", "formula.rounding", "不支持的舍入方式");
        }
    }
}
