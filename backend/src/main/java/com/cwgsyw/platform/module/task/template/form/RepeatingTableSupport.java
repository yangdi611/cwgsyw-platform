package com.cwgsyw.platform.module.task.template.form;

import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;

import java.util.Collection;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

public final class RepeatingTableSupport {
    public static final String ROW_ID = "__rowId";
    public static final Set<String> COLUMN_TYPES = Set.of(
        "auto_number", "text", "textarea", "date", "datetime", "number", "single_select", "file", "image");
    public static final Set<String> ATTACHMENT_TYPES = Set.of("file", "image");
    public static final Set<String> NUMERIC_TYPES = Set.of("number");
    public static final Set<String> SUMMARY_TYPES = Set.of("none", "sum", "avg", "min", "max");
    public static final Pattern KEY = Pattern.compile("^[a-z][a-z0-9_]{0,39}$");
    public static final Pattern ROW_KEY = Pattern.compile("^[a-zA-Z0-9_-]{8,32}$");
    private static final String ATTACHMENT_SEPARATOR = "~";

    private RepeatingTableSupport() {
    }

    public static boolean isTable(TaskFieldDefinition field) {
        return field != null && "table".equals(field.getType());
    }

    public static List<Map<String, Object>> columns(TaskFieldDefinition field) {
        return mapList(field == null || field.getValidation() == null ? null : field.getValidation().get("columns"));
    }

    public static Map<String, Object> validation(TaskFieldDefinition field) {
        return field == null || field.getValidation() == null ? Map.of() : field.getValidation();
    }

    public static Optional<Map<String, Object>> column(TaskFieldDefinition field, String columnKey) {
        return columns(field).stream().filter(column -> columnKey.equals(string(column.get("key")))).findFirst();
    }

    public static String attachmentFieldKey(String tableKey, String rowId, String columnKey) {
        return tableKey + ATTACHMENT_SEPARATOR + rowId + ATTACHMENT_SEPARATOR + columnKey;
    }

    public static Optional<AttachmentLocation> parseAttachmentFieldKey(String fieldKey) {
        if (fieldKey == null) return Optional.empty();
        String[] parts = fieldKey.split(Pattern.quote(ATTACHMENT_SEPARATOR), -1);
        if (parts.length != 3 || !KEY.matcher(parts[0]).matches() || !ROW_KEY.matcher(parts[1]).matches()
                || !KEY.matcher(parts[2]).matches()) return Optional.empty();
        return Optional.of(new AttachmentLocation(parts[0], parts[1], parts[2]));
    }

    public static List<Map<String, Object>> mapList(Object value) {
        if (!(value instanceof Collection<?> collection)) return List.of();
        return collection.stream().filter(Map.class::isInstance)
            .map(item -> toMap((Map<?, ?>) item)).toList();
    }

    public static Map<String, Object> toMap(Map<?, ?> source) {
        Map<String, Object> result = new LinkedHashMap<>();
        source.forEach((key, value) -> result.put(String.valueOf(key), value));
        return result;
    }

    public static String string(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    public static List<Map<String, Object>> defaultRows(TaskFieldDefinition field) {
        Integer configured = integer(validation(field).get("defaultRows"));
        int count = configured == null ? 0 : Math.max(0, configured);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put(ROW_ID, java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 16));
            for (Map<String, Object> column : columns(field)) {
                String key = string(column.get("key"));
                if (key == null) continue;
                if ("auto_number".equals(string(column.get("type")))) {
                    Map<String, Object> columnValidation = column.get("validation") instanceof Map<?, ?> value ? toMap(value) : Map.of();
                    int start = integer(columnValidation.get("start")) == null ? 1 : integer(columnValidation.get("start"));
                    int step = integer(columnValidation.get("step")) == null ? 1 : integer(columnValidation.get("step"));
                    row.put(key, start + index * step);
                }
            }
            rows.add(row);
        }
        return List.copyOf(rows);
    }

    private static Integer integer(Object value) {
        if (value == null) return null;
        try {
            return Integer.valueOf(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    public record AttachmentLocation(String tableKey, String rowId, String columnKey) {
    }
}
