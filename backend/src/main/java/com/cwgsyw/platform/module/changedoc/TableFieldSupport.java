package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.module.changedoc.entity.ChangeDocField;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 表格字段（fieldType = table）配置校验 + fieldsData 表格数据校验。
 * 见 SPEC: docs/plan/changereivew/enhancement1/SPEC.md 第 7、8 节。
 */
@Component
public class TableFieldSupport {

    public static final Set<String> ALLOWED_COLUMN_TYPES =
            Set.of("text", "textarea", "number", "date", "datetime", "select", "checkbox");
    public static final Set<String> ALLOWED_FIELD_TYPES =
            Set.of("text", "textarea", "number", "enum", "date", "datetime", "readonly", "ci_selector", "table");

    private static final Set<String> ALLOWED_TABLE_MODES = Set.of("fixedDocxTable", "dynamicGeneratedTable");

    // ─── §8.1 字段配置保存校验（管理员保存模板字段） ──────────────────────────

    /**
     * 校验单个字段配置（fieldKey/config）。keyCollisionKeys 用于跨字段判重（同模板内 fieldKey 不可重复）。
     * 抛 IllegalArgumentException，message 为面向用户的中文提示。
     */
    public void validateFieldItem(String fieldKey, String fieldType, Map<String, Object> config) {
        if (fieldKey == null || fieldKey.isBlank()) {
            throw new IllegalArgumentException("字段 key 不能为空");
        }
        if (fieldKey.contains(".") || fieldKey.contains("{") || fieldKey.contains("}")) {
            throw new IllegalArgumentException("字段 key 不允许包含 . { }: " + fieldKey);
        }
        if (fieldType == null || !ALLOWED_FIELD_TYPES.contains(fieldType)) {
            throw new IllegalArgumentException("字段 " + fieldKey + " 的类型不合法");
        }
        if (!"table".equals(fieldType)) {
            validateScalarConfig(fieldKey, fieldType, config);
            return;
        }
        if (config == null || config.isEmpty()) {
            throw new IllegalArgumentException("表格字段 " + fieldKey + " 缺少 config 配置");
        }
        Object tableMode = config.get("tableMode");
        if (!(tableMode instanceof String) || !ALLOWED_TABLE_MODES.contains(tableMode)) {
            throw new IllegalArgumentException("表格字段 " + fieldKey + " 的 tableMode 不合法");
        }
        if (!"fixedDocxTable".equals(tableMode)) {
            throw new IllegalArgumentException("表格字段 " + fieldKey + " 第一阶段仅支持 fixedDocxTable");
        }
        Object allowEditColumn = config.get("allowEditColumn");
        if (allowEditColumn != null && Boolean.TRUE.equals(allowEditColumn)) {
            throw new IllegalArgumentException("表格字段 " + fieldKey + " 第一阶段不支持 allowEditColumn=true");
        }

        Object columnsObj = config.get("columns");
        if (!(columnsObj instanceof List<?> columns) || columns.isEmpty()) {
            throw new IllegalArgumentException("表格字段 " + fieldKey + " 至少需要配置一列");
        }

        Object minRowsObj = config.get("minRows");
        Object maxRowsObj = config.get("maxRows");
        Integer minRows = toInteger(minRowsObj);
        Integer maxRows = toInteger(maxRowsObj);
        if (minRows != null && maxRows != null && maxRows < minRows) {
            throw new IllegalArgumentException("表格字段 " + fieldKey + " 的 maxRows 不能小于 minRows");
        }

        Set<String> seenKeys = new HashSet<>();
        for (Object colObj : columns) {
            if (!(colObj instanceof Map<?, ?> col)) {
                throw new IllegalArgumentException("表格字段 " + fieldKey + " 的列配置格式不合法");
            }
            Object keyObj = col.get("key");
            Object labelObj = col.get("label");
            Object typeObj = col.get("type");
            String key = keyObj instanceof String ? (String) keyObj : null;
            String label = labelObj instanceof String ? (String) labelObj : null;
            String type = typeObj instanceof String ? (String) typeObj : null;

            if (key == null || key.isBlank()) {
                throw new IllegalArgumentException("表格字段 " + fieldKey + " 存在列 key 为空");
            }
            if (key.contains(".") || key.contains("{") || key.contains("}")) {
                throw new IllegalArgumentException("表格字段 " + fieldKey + " 的列 key 不允许包含 . { }: " + key);
            }
            if (!seenKeys.add(key)) {
                throw new IllegalArgumentException("表格字段 " + fieldKey + " 的列 key 不可重复: " + key);
            }
            if (label == null || label.isBlank()) {
                throw new IllegalArgumentException("表格字段 " + fieldKey + " 的列 " + key + " label 不能为空");
            }
            if (type == null || !ALLOWED_COLUMN_TYPES.contains(type)) {
                throw new IllegalArgumentException("表格字段 " + fieldKey + " 的列 " + key + " type 不合法");
            }
            if ("select".equals(type)) {
                Object optionsObj = col.get("options");
                if (!(optionsObj instanceof List<?> options) || options.isEmpty()) {
                    throw new IllegalArgumentException("表格列 " + key + " 是下拉类型，必须配置选项");
                }
                Set<String> optionValues = new HashSet<>();
                for (Object optObj : options) {
                    if (!(optObj instanceof Map<?, ?> opt)) {
                        throw new IllegalArgumentException("表格列 " + key + " 的选项格式不合法");
                    }
                    Object valueObj = opt.get("value");
                    String value = valueObj instanceof String ? (String) valueObj : null;
                    if (value == null || value.isBlank()) {
                        throw new IllegalArgumentException("表格列 " + key + " 存在选项 value 为空");
                    }
                    if (!optionValues.add(value)) {
                        throw new IllegalArgumentException("表格列 " + key + " 的选项 value 不可重复: " + value);
                    }
                }
            }
        }
    }

    private void validateScalarConfig(String fieldKey, String fieldType, Map<String, Object> config) {
        if (!"enum".equals(fieldType)) return;
        Object optionsObj = config == null ? null : config.get("options");
        if (!(optionsObj instanceof List<?> options) || options.isEmpty()) {
            throw new IllegalArgumentException("枚举字段 " + fieldKey + " 必须配置选项");
        }
        Set<String> values = new HashSet<>();
        for (Object optionObj : options) {
            if (!(optionObj instanceof Map<?, ?> option) || option.get("value") == null) {
                throw new IllegalArgumentException("枚举字段 " + fieldKey + " 的选项格式不合法");
            }
            String value = String.valueOf(option.get("value")).trim();
            if (value.isEmpty() || !values.add(value)) {
                throw new IllegalArgumentException("枚举字段 " + fieldKey + " 的选项值不可重复或为空");
            }
        }
    }

    // ─── §8.2 变更文档保存校验（fieldsData） ──────────────────────────────────

    /**
     * 按模板字段配置校验并规整 fieldsData（补齐缺失 rowId、类型/选项校验）。
     * 返回规整后的新 Map；不修改传入的 fieldsData。
     *
     * <p>{@code enforceRequired} 控制是否校验必填：create/submit/submitPlan 场景为 true；
     * update 场景为 false，允许保存未完成的草稿进度，必填校验推迟到提交时进行
     * （结构性/类型校验始终生效，避免脏数据被持久化）。</p>
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> validateAndNormalize(List<ChangeDocField> fields, Map<String, Object> fieldsData,
                                                      boolean enforceRequired) {
        Map<String, Object> data = fieldsData != null ? new LinkedHashMap<>(fieldsData) : new LinkedHashMap<>();
        for (ChangeDocField field : fields) {
            if (!"table".equals(field.getFieldType())) {
                validateScalarValue(field, data.get(field.getFieldKey()));
                if (enforceRequired && Boolean.TRUE.equals(field.getRequired())) {
                    Object v = data.get(field.getFieldKey());
                    if (v == null || (v instanceof String s && s.trim().isEmpty())) {
                        throw new IllegalArgumentException(field.getLabel() + "不能为空");
                    }
                }
                continue;
            }
            data.put(field.getFieldKey(), validateTableField(field, data.get(field.getFieldKey()), enforceRequired));
        }
        return data;
    }

    private void validateScalarValue(ChangeDocField field, Object value) {
        if (value == null || (value instanceof String text && text.isBlank())) return;
        if ("number".equals(field.getFieldType())) {
            try {
                Double.parseDouble(String.valueOf(value));
            } catch (NumberFormatException exception) {
                throw new IllegalArgumentException(field.getLabel() + "不是有效数字");
            }
        }
        if ("enum".equals(field.getFieldType())) {
            Object optionsObj = field.getConfig() == null ? null : field.getConfig().get("options");
            boolean found = optionsObj instanceof List<?> options && options.stream()
                .filter(Map.class::isInstance).map(Map.class::cast)
                .anyMatch(option -> String.valueOf(option.get("value")).equals(String.valueOf(value)));
            if (!found) throw new IllegalArgumentException(field.getLabel() + "不是有效选项");
        }
    }

    private List<Map<String, Object>> validateTableField(ChangeDocField field, Object rawValue, boolean enforceRequired) {
        Map<String, Object> config = field.getConfig() != null ? field.getConfig() : Map.of();
        boolean required = enforceRequired && Boolean.TRUE.equals(field.getRequired());
        String label = field.getLabel() != null ? field.getLabel() : field.getFieldKey();

        if (rawValue == null) {
            if (required) throw new IllegalArgumentException(label + "至少需要一行数据");
            return List.of();
        }
        if (!(rawValue instanceof List<?> rawList)) {
            throw new IllegalArgumentException(label + "数据格式不合法，必须是数组");
        }
        if (rawList.isEmpty()) {
            if (required) throw new IllegalArgumentException(label + "至少需要一行数据");
            return List.of();
        }

        Integer maxRows = toInteger(config.get("maxRows"));
        if (maxRows != null && rawList.size() > maxRows) {
            throw new IllegalArgumentException(label + "最多允许 " + maxRows + " 行");
        }

        List<?> columnsRaw = config.get("columns") instanceof List<?> l ? l : List.of();
        List<Map<String, Object>> columns = new ArrayList<>();
        for (Object c : columnsRaw) {
            if (c instanceof Map<?, ?> m) {
                @SuppressWarnings("unchecked")
                Map<String, Object> cm = (Map<String, Object>) m;
                columns.add(cm);
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        int rowIndex = 0;
        for (Object rowObj : rawList) {
            rowIndex++;
            if (!(rowObj instanceof Map<?, ?> rawRow)) {
                throw new IllegalArgumentException(label + "第 " + rowIndex + " 行格式不合法");
            }
            Map<String, Object> row = new LinkedHashMap<>();
            for (Map.Entry<?, ?> e : rawRow.entrySet()) {
                row.put(String.valueOf(e.getKey()), e.getValue());
            }
            Object rowId = row.get("rowId");
            if (!(rowId instanceof String) || ((String) rowId).isBlank()) {
                row.put("rowId", UUID.randomUUID().toString());
            }

            for (Map<String, Object> col : columns) {
                String key = String.valueOf(col.get("key"));
                String colLabel = col.get("label") != null ? String.valueOf(col.get("label")) : key;
                String type = col.get("type") != null ? String.valueOf(col.get("type")) : "text";
                boolean colRequired = enforceRequired && Boolean.TRUE.equals(col.get("required"));
                Object cellValue = row.get(key);
                boolean blank = cellValue == null
                        || (cellValue instanceof String s && s.trim().isEmpty());

                if (colRequired && blank) {
                    throw new IllegalArgumentException(label + "第 " + rowIndex + " 行“" + colLabel + "”不能为空");
                }
                if (blank) continue;

                switch (type) {
                    case "select" -> {
                        Object optionsObj = col.get("options");
                        Set<String> values = new HashSet<>();
                        if (optionsObj instanceof List<?> options) {
                            for (Object o : options) {
                                if (o instanceof Map<?, ?> om && om.get("value") != null) {
                                    values.add(String.valueOf(om.get("value")));
                                }
                            }
                        }
                        if (!values.contains(String.valueOf(cellValue))) {
                            throw new IllegalArgumentException(label + "第 " + rowIndex + " 行“" + colLabel + "”不是有效选项");
                        }
                    }
                    case "number" -> {
                        try {
                            if (cellValue instanceof String s) {
                                Double.parseDouble(s);
                            } else if (!(cellValue instanceof Number)) {
                                throw new NumberFormatException();
                            }
                        } catch (NumberFormatException ex) {
                            throw new IllegalArgumentException(label + "第 " + rowIndex + " 行“" + colLabel + "”不是有效数字");
                        }
                    }
                    case "checkbox" -> {
                        if (!(cellValue instanceof Boolean)) {
                            throw new IllegalArgumentException(label + "第 " + rowIndex + " 行“" + colLabel + "”必须是布尔值");
                        }
                    }
                    default -> { /* text/textarea/date/datetime 不额外校验类型 */ }
                }
            }
            result.add(row);
        }
        return result;
    }

    private Integer toInteger(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.intValue();
        if (o instanceof String s) {
            try { return Integer.parseInt(s.trim()); } catch (NumberFormatException e) { return null; }
        }
        return null;
    }
}
