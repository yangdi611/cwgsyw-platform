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
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

final class RepeatingTableFieldHandler implements FieldTypeHandler {
    private static final int MAX_ROWS = 200;
    private final FieldTypeMetadata metadata;

    RepeatingTableFieldHandler(FieldTypeMetadata metadata) {
        this.metadata = metadata;
    }

    @Override
    public FieldTypeMetadata metadata() {
        return metadata;
    }

    @Override
    public List<TemplateValidationIssue> validateConfiguration(TaskFieldDefinition field) {
        List<TemplateValidationIssue> issues = new ArrayList<>();
        Map<String, Object> validation = RepeatingTableSupport.validation(field);
        Integer defaultRows = integer(validation.get("defaultRows"));
        Integer minRows = integer(validation.get("minRows"));
        Integer maxRows = integer(validation.get("maxRows"));
        validateRowBound(field, "defaultRows", defaultRows, issues);
        validateRowBound(field, "minRows", minRows, issues);
        validateRowBound(field, "maxRows", maxRows, issues);
        int effectiveMin = minRows == null ? 0 : minRows;
        int effectiveMax = maxRows == null ? MAX_ROWS : maxRows;
        if (effectiveMin > effectiveMax) issues.add(issue(field, "validation", "最少行数不能大于最多行数"));
        if (defaultRows != null && (defaultRows < effectiveMin || defaultRows > effectiveMax)) {
            issues.add(issue(field, "validation.defaultRows", "默认行数必须位于最少行数和最多行数之间"));
        }
        List<Map<String, Object>> columns = RepeatingTableSupport.columns(field);
        if (columns.isEmpty()) {
            issues.add(issue(field, "validation.columns", "自定义表格至少需要一列"));
            return issues;
        }
        Set<String> keys = new LinkedHashSet<>();
        for (int index = 0; index < columns.size(); index++) {
            Map<String, Object> column = columns.get(index);
            String path = "validation.columns[" + index + "]";
            String key = RepeatingTableSupport.string(column.get("key"));
            String label = RepeatingTableSupport.string(column.get("label"));
            String type = RepeatingTableSupport.string(column.get("type"));
            if (key == null || !RepeatingTableSupport.KEY.matcher(key).matches()) {
                issues.add(issue(field, path + ".key", "列编码必须是小写字母、数字或下划线，且不超过 40 个字符"));
            } else if (!keys.add(key)) {
                issues.add(issue(field, path + ".key", "列编码重复: " + key));
            }
            if (label == null || label.isBlank()) issues.add(issue(field, path + ".label", "列标题不能为空"));
            if (!RepeatingTableSupport.COLUMN_TYPES.contains(type)) {
                issues.add(issue(field, path + ".type", "不支持的表格列类型: " + type));
                continue;
            }
            if ("auto_number".equals(type)) validateAutoNumber(field, column, path, issues);
            if ("number".equals(type)) validateNumber(field, column, path, issues);
            if ("single_select".equals(type) && options(column).isEmpty()) {
                issues.add(issue(field, path + ".validation.options", "下拉列至少需要一个选项"));
            }
            if (RepeatingTableSupport.ATTACHMENT_TYPES.contains(type)) validateAttachment(field, column, path, issues);
            String summary = RepeatingTableSupport.string(column.get("summary"));
            if (summary != null && !RepeatingTableSupport.SUMMARY_TYPES.contains(summary)) {
                issues.add(issue(field, path + ".summary", "不支持的汇总方式: " + summary));
            } else if (summary != null && !"none".equals(summary) && !"number".equals(type)) {
                issues.add(issue(field, path + ".summary", "只有数字列可以配置汇总方式"));
            }
            if (key != null && field.getKey() != null && RepeatingTableSupport.attachmentFieldKey(field.getKey(), "abcdefgh12345678", key).length() > 100) {
                issues.add(issue(field, path + ".key", "表格字段编码和列编码组合过长，无法保存行内附件"));
            }
        }
        return issues;
    }

    @Override
    public FieldValueResult normalizeAndValidate(TaskFieldDefinition field, Object value, String path) {
        if (!(value instanceof Collection<?> inputRows)) return invalid(field, path, "必须是表格行数组");
        List<Map<String, Object>> columns = RepeatingTableSupport.columns(field);
        Map<String, Object> validation = RepeatingTableSupport.validation(field);
        int minRows = integer(validation.get("minRows")) == null ? 0 : integer(validation.get("minRows"));
        int maxRows = integer(validation.get("maxRows")) == null ? MAX_ROWS : integer(validation.get("maxRows"));
        List<TemplateValidationIssue> issues = new ArrayList<>();
        if (inputRows.size() < minRows) issues.add(valueIssue(field, path, "表格行数不能少于 " + minRows));
        if (inputRows.size() > maxRows) issues.add(valueIssue(field, path, "表格行数不能超过 " + maxRows));
        List<Map<String, Object>> normalized = new ArrayList<>();
        Set<String> rowIds = new LinkedHashSet<>();
        for (int rowIndex = 0; rowIndex < inputRows.size(); rowIndex++) {
            Object rawRow = inputRows.stream().skip(rowIndex).findFirst().orElse(null);
            if (!(rawRow instanceof Map<?, ?> map)) {
                issues.add(valueIssue(field, path + "[" + rowIndex + "]", "行数据必须是对象"));
                continue;
            }
            Map<String, Object> row = RepeatingTableSupport.toMap(map);
            String rowId = RepeatingTableSupport.string(row.get(RepeatingTableSupport.ROW_ID));
            if (rowId == null) rowId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
            if (!RepeatingTableSupport.ROW_KEY.matcher(rowId).matches() || !rowIds.add(rowId)) {
                issues.add(valueIssue(field, path + "[" + rowIndex + "]." + RepeatingTableSupport.ROW_ID, "行标识无效或重复"));
                continue;
            }
            Map<String, Object> next = new LinkedHashMap<>();
            next.put(RepeatingTableSupport.ROW_ID, rowId);
            for (Map<String, Object> column : columns) {
                String key = RepeatingTableSupport.string(column.get("key"));
                String type = RepeatingTableSupport.string(column.get("type"));
                if (key == null || type == null) continue;
                String cellPath = path + "[" + rowIndex + "]." + key;
                Object cell = row.get(key);
                if ("auto_number".equals(type)) {
                    next.put(key, autoNumber(column, rowIndex));
                    continue;
                }
                if (Boolean.TRUE.equals(column.get("required")) && empty(cell)) {
                    issues.add(valueIssue(field, cellPath, "该单元格为必填项"));
                    continue;
                }
                if (empty(cell)) {
                    next.put(key, null);
                    continue;
                }
                FieldValueResult result = normalizeCell(field, column, cell, cellPath);
                issues.addAll(result.issues());
                next.put(key, result.value());
            }
            normalized.add(next);
        }
        return new FieldValueResult(List.copyOf(normalized), List.copyOf(issues));
    }

    private FieldValueResult normalizeCell(TaskFieldDefinition field, Map<String, Object> column, Object value, String path) {
        String type = RepeatingTableSupport.string(column.get("type"));
        try {
            if (Set.of("text", "textarea").contains(type)) return validateText(field, column, String.valueOf(value), path);
            if ("number".equals(type)) return validateNumberValue(field, column, value, path);
            if ("single_select".equals(type)) return validateSelect(field, column, value, path);
            if ("date".equals(type)) return FieldValueResult.valid(LocalDate.parse(String.valueOf(value)).toString());
            if ("datetime".equals(type)) return FieldValueResult.valid(LocalDateTime.parse(String.valueOf(value)).toString());
            if (RepeatingTableSupport.ATTACHMENT_TYPES.contains(type)) return validateAttachments(field, column, value, path);
            return FieldValueResult.valid(value);
        } catch (DateTimeParseException | NumberFormatException exception) {
            return invalid(field, path, "值格式不正确");
        }
    }

    private FieldValueResult validateText(TaskFieldDefinition field, Map<String, Object> column, String value, String path) {
        Map<String, Object> validation = map(column.get("validation"));
        Integer minLength = integer(validation.get("minLength"));
        Integer maxLength = integer(validation.get("maxLength"));
        if (minLength != null && value.length() < minLength) return invalid(field, path, "长度不能小于 " + minLength);
        if (maxLength != null && value.length() > maxLength) return invalid(field, path, "长度不能大于 " + maxLength);
        return FieldValueResult.valid(value);
    }

    private FieldValueResult validateNumberValue(TaskFieldDefinition field, Map<String, Object> column, Object value, String path) {
        BigDecimal number = new BigDecimal(String.valueOf(value));
        Map<String, Object> validation = map(column.get("validation"));
        BigDecimal min = decimal(validation.get("min"));
        BigDecimal max = decimal(validation.get("max"));
        Integer scale = integer(validation.get("scale"));
        if (min != null && number.compareTo(min) < 0) return invalid(field, path, "必须大于等于 " + min.toPlainString());
        if (max != null && number.compareTo(max) > 0) return invalid(field, path, "必须小于等于 " + max.toPlainString());
        if (scale != null && number.scale() > scale) return invalid(field, path, "小数位不能超过 " + scale);
        return FieldValueResult.valid(scale == null ? number : number.setScale(scale, RoundingMode.HALF_UP));
    }

    private FieldValueResult validateSelect(TaskFieldDefinition field, Map<String, Object> column, Object value, String path) {
        Set<String> options = options(column);
        if (!options.contains(String.valueOf(value))) return invalid(field, path, "包含不存在或已停用的选项");
        return FieldValueResult.valid(String.valueOf(value));
    }

    private FieldValueResult validateAttachments(TaskFieldDefinition field, Map<String, Object> column, Object value, String path) {
        if (!(value instanceof Collection<?> attachments)) return invalid(field, path, "附件值必须是数组");
        Map<String, Object> validation = map(column.get("validation"));
        Integer min = integer(validation.get("minCount"));
        Integer max = integer(validation.get("maxCount"));
        if (min != null && attachments.size() < min) return invalid(field, path, "附件数量不能少于 " + min);
        if (max != null && attachments.size() > max) return invalid(field, path, "附件数量不能超过 " + max);
        return FieldValueResult.valid(List.copyOf(attachments));
    }

    private void validateAutoNumber(TaskFieldDefinition field, Map<String, Object> column, String path, List<TemplateValidationIssue> issues) {
        Map<String, Object> validation = map(column.get("validation"));
        Integer start = integer(validation.get("start"));
        Integer step = integer(validation.get("step"));
        if (start != null && start < 1) issues.add(issue(field, path + ".validation.start", "起始值必须为正整数"));
        if (step != null && step < 1) issues.add(issue(field, path + ".validation.step", "步长必须为正整数"));
    }

    private void validateNumber(TaskFieldDefinition field, Map<String, Object> column, String path, List<TemplateValidationIssue> issues) {
        Map<String, Object> validation = map(column.get("validation"));
        BigDecimal min = decimal(validation.get("min"));
        BigDecimal max = decimal(validation.get("max"));
        Integer scale = integer(validation.get("scale"));
        if (validation.containsKey("min") && min == null) issues.add(issue(field, path + ".validation.min", "最小值必须是数字"));
        if (validation.containsKey("max") && max == null) issues.add(issue(field, path + ".validation.max", "最大值必须是数字"));
        if (scale != null && scale < 0) issues.add(issue(field, path + ".validation.scale", "小数位必须是非负整数"));
        if (min != null && max != null && min.compareTo(max) > 0) issues.add(issue(field, path + ".validation", "最小值不能大于最大值"));
    }

    private void validateAttachment(TaskFieldDefinition field, Map<String, Object> column, String path, List<TemplateValidationIssue> issues) {
        Map<String, Object> validation = map(column.get("validation"));
        for (String key : List.of("minCount", "maxCount", "maxSize")) {
            Integer value = integer(validation.get(key));
            if (validation.containsKey(key) && (value == null || value < 0)) issues.add(issue(field, path + ".validation." + key, key + " 必须是非负整数"));
        }
    }

    private void validateRowBound(TaskFieldDefinition field, String key, Integer value, List<TemplateValidationIssue> issues) {
        if (value == null && RepeatingTableSupport.validation(field).containsKey(key)) {
            issues.add(issue(field, "validation." + key, key + " 必须是非负整数"));
        } else if (value != null && (value < 0 || value > MAX_ROWS)) {
            issues.add(issue(field, "validation." + key, key + " 必须在 0 到 " + MAX_ROWS + " 之间"));
        }
    }

    private int autoNumber(Map<String, Object> column, int rowIndex) {
        Map<String, Object> validation = map(column.get("validation"));
        int start = integer(validation.get("start")) == null ? 1 : integer(validation.get("start"));
        int step = integer(validation.get("step")) == null ? 1 : integer(validation.get("step"));
        return start + rowIndex * step;
    }

    private static Map<String, Object> map(Object value) {
        return value instanceof Map<?, ?> map ? RepeatingTableSupport.toMap(map) : Map.of();
    }

    private static Set<String> options(Map<String, Object> column) {
        return RepeatingTableSupport.mapList(map(column.get("validation")).get("options")).stream()
            .filter(option -> !Boolean.TRUE.equals(option.get("disabled")))
            .map(option -> RepeatingTableSupport.string(option.get("value")))
            .filter(java.util.Objects::nonNull)
            .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    private static Integer integer(Object value) {
        if (value == null) return null;
        try { return Integer.valueOf(String.valueOf(value)); } catch (NumberFormatException exception) { return null; }
    }

    private static BigDecimal decimal(Object value) {
        if (value == null) return null;
        try { return new BigDecimal(String.valueOf(value)); } catch (NumberFormatException exception) { return null; }
    }

    private static boolean empty(Object value) {
        return value == null || value instanceof String text && text.isBlank() || value instanceof Collection<?> values && values.isEmpty();
    }

    private static FieldValueResult invalid(TaskFieldDefinition field, String path, String message) {
        return new FieldValueResult(null, List.of(valueIssue(field, path, message)));
    }

    private static TemplateValidationIssue valueIssue(TaskFieldDefinition field, String path, String message) {
        return new TemplateValidationIssue("FIELD_VALUE_INVALID", field.getKey(), path, message);
    }

    private static TemplateValidationIssue issue(TaskFieldDefinition field, String path, String message) {
        return new TemplateValidationIssue("FIELD_CONFIG_INVALID", field.getKey(), path, message);
    }
}
