package com.cwgsyw.platform.module.task.template.form;

import com.cwgsyw.platform.module.task.template.dto.FieldTypeMetadata;
import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.dto.TemplateValidationIssue;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

final class BuiltinFieldTypeHandler implements FieldTypeHandler {
    private static final Set<String> TEXT_TYPES = Set.of("text", "textarea", "rich_text", "tags");
    private static final Set<String> NUMBER_TYPES = Set.of("number", "money", "percentage", "rating", "duration");
    private static final Set<String> SELECT_TYPES = Set.of("single_select", "multi_select");
    private static final Set<String> LIST_TYPES = Set.of("multi_select", "tags", "date_range", "table", "repeater", "file", "image");
    private static final Set<String> ID_TYPES = Set.of("user", "group", "role");
    private static final Set<String> STRUCTURAL_TYPES = Set.of("section", "help_text", "formula");

    private final FieldTypeMetadata metadata;

    BuiltinFieldTypeHandler(FieldTypeMetadata metadata) {
        this.metadata = metadata;
    }

    @Override
    public FieldTypeMetadata metadata() {
        return metadata;
    }

    @Override
    public List<TemplateValidationIssue> validateConfiguration(TaskFieldDefinition field) {
        List<TemplateValidationIssue> issues = new ArrayList<>();
        Map<String, Object> validation = safeMap(field.getValidation());
        if (TEXT_TYPES.contains(metadata.type())) {
            validateNonNegativeInteger(field, validation, "minLength", issues);
            validateNonNegativeInteger(field, validation, "maxLength", issues);
            Object pattern = validation.get("pattern");
            if (pattern != null) {
                try {
                    Pattern.compile(String.valueOf(pattern));
                } catch (PatternSyntaxException exception) {
                    issues.add(issue(field, "FIELD_CONFIG_INVALID", "validation.pattern", "正则表达式无效"));
                }
            }
        }
        if (NUMBER_TYPES.contains(metadata.type())) {
            validateDecimal(field, validation, "min", issues);
            validateDecimal(field, validation, "max", issues);
            validateNonNegativeInteger(field, validation, "scale", issues);
            BigDecimal min = decimalOrNull(validation.get("min"));
            BigDecimal max = decimalOrNull(validation.get("max"));
            if (min != null && max != null && min.compareTo(max) > 0) {
                issues.add(issue(field, "FIELD_CONFIG_INVALID", "validation", "最小值不能大于最大值"));
            }
        }
        if ("aggregate_reference".equals(metadata.type())) {
            validateAggregateReferenceConfiguration(field, validation, issues);
        }
        if (SELECT_TYPES.contains(metadata.type()) && options(validation).isEmpty()) {
            issues.add(issue(field, "FIELD_CONFIG_INVALID", "validation.options", "选择字段至少需要一个选项"));
        }
        if (Set.of("file", "image").contains(metadata.type())) {
            validateNonNegativeInteger(field, validation, "minCount", issues);
            validateNonNegativeInteger(field, validation, "maxCount", issues);
            validateNonNegativeInteger(field, validation, "maxSize", issues);
        }
        if (Set.of("table", "repeater").contains(metadata.type())) {
            Object columns = validation.get("columns");
            if (!(columns instanceof Collection<?> collection) || collection.isEmpty()) {
                issues.add(issue(field, "FIELD_CONFIG_INVALID", "validation.columns", "表格或重复区块至少需要一列"));
            }
        }
        if (Boolean.TRUE.equals(field.getSensitive())) {
            Map<String, Object> visibility = safeMap(field.getVisibility());
            Map<String, Object> analytics = safeMap(field.getAnalytics());
            if (Boolean.TRUE.equals(visibility.get("export")) || Boolean.TRUE.equals(analytics.get("enabled"))) {
                issues.add(issue(field, "SENSITIVE_FIELD_EXPOSURE", "visibility", "敏感字段不得导出或生成统计事实"));
            }
        }
        if (Boolean.TRUE.equals(safeMap(field.getAnalytics()).get("enabled"))) {
            String aggregation = stringOrNull(safeMap(field.getAnalytics()).get("aggregation"));
            if (!metadata.supportsAnalytics()) {
                issues.add(issue(field, "ANALYTICS_NOT_SUPPORTED", "analytics.enabled", "该字段类型不支持统计"));
            } else if (aggregation != null && !metadata.aggregations().contains(aggregation)) {
                issues.add(issue(field, "ANALYTICS_AGGREGATION_INVALID", "analytics.aggregation", "该字段类型不支持此聚合方式"));
            }
        }
        return issues;
    }

    @Override
    public FieldValueResult normalizeAndValidate(TaskFieldDefinition field, Object value, String path) {
        if (value == null || value instanceof String string && string.isBlank()) {
            return FieldValueResult.valid(null);
        }
        try {
            if (TEXT_TYPES.contains(metadata.type())) {
                return validateText(field, String.valueOf(value), path);
            }
            if (NUMBER_TYPES.contains(metadata.type())) {
                return validateNumber(field, value, path);
            }
            if ("aggregate_reference".equals(metadata.type())) {
                return validateNumber(field, value, path);
            }
            if (SELECT_TYPES.contains(metadata.type())) {
                return validateSelection(field, value, path);
            }
            if ("boolean".equals(metadata.type())) {
                if (value instanceof Boolean) return FieldValueResult.valid(value);
                if ("true".equalsIgnoreCase(String.valueOf(value)) || "false".equalsIgnoreCase(String.valueOf(value))) {
                    return FieldValueResult.valid(Boolean.valueOf(String.valueOf(value)));
                }
                return invalid(field, path, "必须是布尔值");
            }
            if ("date".equals(metadata.type())) {
                return FieldValueResult.valid(LocalDate.parse(String.valueOf(value)).toString());
            }
            if ("datetime".equals(metadata.type())) {
                return FieldValueResult.valid(LocalDateTime.parse(String.valueOf(value)).toString());
            }
            if (LIST_TYPES.contains(metadata.type())) {
                if (!(value instanceof Collection<?> collection)) return invalid(field, path, "必须是数组");
                if (Set.of("file", "image").contains(metadata.type())) return validateAttachmentCount(field, collection, path);
                if (Set.of("table", "repeater").contains(metadata.type())) return validateRows(field, collection, path);
                return FieldValueResult.valid(List.copyOf(collection));
            }
            if (ID_TYPES.contains(metadata.type())) {
                long id = Long.parseLong(String.valueOf(value));
                return id > 0 ? FieldValueResult.valid(id) : invalid(field, path, "ID 必须大于 0");
            }
            if (Set.of("ci_scope", "relation").contains(metadata.type())) {
                if (value instanceof Map<?, ?> || value instanceof Collection<?>) return FieldValueResult.valid(value);
                return invalid(field, path, "引用值必须是对象或数组");
            }
            if (STRUCTURAL_TYPES.contains(metadata.type())) return FieldValueResult.valid(value);
            return FieldValueResult.valid(value);
        } catch (NumberFormatException | DateTimeParseException exception) {
            return invalid(field, path, "值格式不正确");
        }
    }

    private FieldValueResult validateText(TaskFieldDefinition field, String value, String path) {
        Map<String, Object> validation = safeMap(field.getValidation());
        Integer minLength = integerOrNull(validation.get("minLength"));
        Integer maxLength = integerOrNull(validation.get("maxLength"));
        if (minLength != null && value.length() < minLength) return invalid(field, path, "长度不能小于 " + minLength);
        if (maxLength != null && value.length() > maxLength) return invalid(field, path, "长度不能大于 " + maxLength);
        Object pattern = validation.get("pattern");
        if (pattern != null && !Pattern.compile(String.valueOf(pattern)).matcher(value).matches()) {
            return invalid(field, path, "格式不符合要求");
        }
        return FieldValueResult.valid(value);
    }

    @SuppressWarnings("unchecked")
    private void validateAggregateReferenceConfiguration(TaskFieldDefinition field, Map<String, Object> validation,
                                                         List<TemplateValidationIssue> issues) {
        Object raw = validation.get("aggregate");
        if (!(raw instanceof Map<?, ?> rawConfig)) {
            issues.add(issue(field, "FIELD_CONFIG_INVALID", "validation.aggregate", "汇总引用必须配置指标和时间窗口"));
            return;
        }
        Map<String, Object> aggregate = (Map<String, Object>) rawConfig;
        Long metricId = positiveLong(aggregate.get("metricId"));
        if (metricId == null) issues.add(issue(field, "FIELD_CONFIG_INVALID", "validation.aggregate.metricId", "指标必须是正整数"));
        LocalDate from = dateOrNull(aggregate.get("from"));
        LocalDate to = dateOrNull(aggregate.get("to"));
        if (from == null) issues.add(issue(field, "FIELD_CONFIG_INVALID", "validation.aggregate.from", "开始日期必须是 ISO 日期"));
        if (to == null) issues.add(issue(field, "FIELD_CONFIG_INVALID", "validation.aggregate.to", "结束日期必须是 ISO 日期"));
        if (from != null && to != null && from.isAfter(to)) {
            issues.add(issue(field, "FIELD_CONFIG_INVALID", "validation.aggregate", "开始日期不能晚于结束日期"));
        }
        if (aggregate.get("groupId") != null && positiveLong(aggregate.get("groupId")) == null) {
            issues.add(issue(field, "FIELD_CONFIG_INVALID", "validation.aggregate.groupId", "组织必须是正整数"));
        }
    }

    private FieldValueResult validateNumber(TaskFieldDefinition field, Object value, String path) {
        BigDecimal number = new BigDecimal(String.valueOf(value));
        Map<String, Object> validation = safeMap(field.getValidation());
        BigDecimal min = decimalOrNull(validation.get("min"));
        BigDecimal max = decimalOrNull(validation.get("max"));
        Integer scale = integerOrNull(validation.get("scale"));
        if (min != null && number.compareTo(min) < 0) return invalid(field, path, "必须大于等于 " + min.toPlainString());
        if (max != null && number.compareTo(max) > 0) return invalid(field, path, "必须小于等于 " + max.toPlainString());
        if (scale != null && number.scale() > scale) return invalid(field, path, "小数位不能超过 " + scale);
        return FieldValueResult.valid(scale == null ? number : number.setScale(scale, RoundingMode.HALF_UP));
    }

    private FieldValueResult validateSelection(TaskFieldDefinition field, Object value, String path) {
        Set<String> validOptions = options(safeMap(field.getValidation()));
        Collection<?> values = value instanceof Collection<?> collection ? collection : List.of(value);
        for (Object item : values) {
            if (!validOptions.contains(String.valueOf(item))) return invalid(field, path, "包含不存在或已停用的选项");
        }
        return FieldValueResult.valid("multi_select".equals(metadata.type()) ? List.copyOf(values) : value);
    }

    private FieldValueResult validateAttachmentCount(TaskFieldDefinition field, Collection<?> value, String path) {
        Map<String, Object> validation = safeMap(field.getValidation());
        Integer minCount = integerOrNull(validation.get("minCount"));
        Integer maxCount = integerOrNull(validation.get("maxCount"));
        if (minCount != null && value.size() < minCount) return invalid(field, path, "附件数量不能少于 " + minCount);
        if (maxCount != null && value.size() > maxCount) return invalid(field, path, "附件数量不能超过 " + maxCount);
        return FieldValueResult.valid(List.copyOf(value));
    }

    private FieldValueResult validateRows(TaskFieldDefinition field, Collection<?> value, String path) {
        List<TemplateValidationIssue> issues = new ArrayList<>();
        List<Map<String, Object>> columns = mapList(safeMap(field.getValidation()).get("columns"));
        int rowIndex = 0;
        for (Object rowValue : value) {
            if (!(rowValue instanceof Map<?, ?> rawRow)) {
                issues.add(valueIssue(field, path + "[" + rowIndex + "]", "行数据必须是对象"));
                rowIndex++;
                continue;
            }
            for (Map<String, Object> column : columns) {
                String key = stringOrNull(column.get("key"));
                if (key == null) continue;
                Object cell = rawRow.get(key);
                if (Boolean.TRUE.equals(column.get("required")) && isEmpty(cell)) {
                    issues.add(valueIssue(field, path + "[" + rowIndex + "]." + key, "该单元格为必填项"));
                }
            }
            rowIndex++;
        }
        return new FieldValueResult(List.copyOf(value), issues);
    }

    private static Set<String> options(Map<String, Object> validation) {
        List<Map<String, Object>> options = mapList(validation.get("options"));
        return options.stream()
            .filter(option -> !Boolean.TRUE.equals(option.get("disabled")))
            .map(option -> String.valueOf(option.get("value")))
            .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> mapList(Object value) {
        if (!(value instanceof Collection<?> collection)) return List.of();
        return collection.stream()
            .filter(Map.class::isInstance)
            .map(item -> (Map<String, Object>) item)
            .toList();
    }

    private static Map<String, Object> safeMap(Map<String, Object> value) {
        return value == null ? Map.of() : value;
    }

    private static void validateNonNegativeInteger(TaskFieldDefinition field, Map<String, Object> config,
                                                   String key, List<TemplateValidationIssue> issues) {
        if (!config.containsKey(key)) return;
        Integer value = integerOrNull(config.get(key));
        if (value == null || value < 0) issues.add(issue(field, "FIELD_CONFIG_INVALID", "validation." + key, key + " 必须是非负整数"));
    }

    private static void validateDecimal(TaskFieldDefinition field, Map<String, Object> config,
                                        String key, List<TemplateValidationIssue> issues) {
        if (config.containsKey(key) && decimalOrNull(config.get(key)) == null) {
            issues.add(issue(field, "FIELD_CONFIG_INVALID", "validation." + key, key + " 必须是数字"));
        }
    }

    private static Integer integerOrNull(Object value) {
        if (value == null) return null;
        try {
            return Integer.valueOf(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private static BigDecimal decimalOrNull(Object value) {
        if (value == null) return null;
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private static Long positiveLong(Object value) {
        if (value == null) return null;
        try {
            long parsed = Long.parseLong(String.valueOf(value));
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private static LocalDate dateOrNull(Object value) {
        if (value == null) return null;
        try {
            return LocalDate.parse(String.valueOf(value));
        } catch (DateTimeParseException exception) {
            return null;
        }
    }

    private static String stringOrNull(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static boolean isEmpty(Object value) {
        return value == null || value instanceof String string && string.isBlank()
            || value instanceof Collection<?> collection && collection.isEmpty();
    }

    private static FieldValueResult invalid(TaskFieldDefinition field, String path, String message) {
        return new FieldValueResult(null, List.of(valueIssue(field, path, message)));
    }

    private static TemplateValidationIssue valueIssue(TaskFieldDefinition field, String path, String message) {
        return new TemplateValidationIssue("FIELD_VALUE_INVALID", field.getKey(), path, message);
    }

    private static TemplateValidationIssue issue(TaskFieldDefinition field, String code, String path, String message) {
        return new TemplateValidationIssue(code, field.getKey(), path, message);
    }
}
