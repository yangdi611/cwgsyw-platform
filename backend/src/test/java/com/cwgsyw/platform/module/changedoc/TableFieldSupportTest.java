package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.module.changedoc.entity.ChangeDocField;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.*;

class TableFieldSupportTest {

    private final TableFieldSupport support = new TableFieldSupport();

    // ─── validateFieldItem: 字段配置保存校验 ───────────────────────────────

    @Test
    void validateFieldItem_nonTableField_onlyChecksKey() {
        assertThatCode(() -> support.validateFieldItem("change_desc", "textarea", null))
                .doesNotThrowAnyException();
    }

    @Test
    void validateFieldItem_blankKey_throws() {
        assertThatThrownBy(() -> support.validateFieldItem("", "textarea", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("key");
    }

    @Test
    void validateFieldItem_keyWithDot_throws() {
        assertThatThrownBy(() -> support.validateFieldItem("servers.name", "textarea", null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void validateFieldItem_tableField_missingConfig_throws() {
        assertThatThrownBy(() -> support.validateFieldItem("servers", "table", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("config");
    }

    @Test
    void validateFieldItem_tableField_wrongTableMode_throws() {
        Map<String, Object> config = new HashMap<>();
        config.put("tableMode", "dynamicGeneratedTable");
        assertThatThrownBy(() -> support.validateFieldItem("servers", "table", config))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("fixedDocxTable");
    }

    @Test
    void validateFieldItem_tableField_allowEditColumnTrue_throws() {
        Map<String, Object> config = validTableConfig();
        config.put("allowEditColumn", true);
        assertThatThrownBy(() -> support.validateFieldItem("servers", "table", config))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("allowEditColumn");
    }

    @Test
    void validateFieldItem_tableField_noColumns_throws() {
        Map<String, Object> config = validTableConfig();
        config.put("columns", List.of());
        assertThatThrownBy(() -> support.validateFieldItem("servers", "table", config))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("至少需要配置一列");
    }

    @Test
    void validateFieldItem_tableField_duplicateColumnKey_throws() {
        Map<String, Object> config = validTableConfig();
        config.put("columns", List.of(
                col("name", "名称", "text"),
                col("name", "名称2", "text")
        ));
        assertThatThrownBy(() -> support.validateFieldItem("servers", "table", config))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("不可重复");
    }

    @Test
    void validateFieldItem_tableField_selectColumnWithoutOptions_throws() {
        Map<String, Object> config = validTableConfig();
        Map<String, Object> selectCol = col("status", "状态", "select");
        config.put("columns", List.of(selectCol));
        assertThatThrownBy(() -> support.validateFieldItem("servers", "table", config))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("选项");
    }

    @Test
    void validateFieldItem_tableField_maxRowsLessThanMinRows_throws() {
        Map<String, Object> config = validTableConfig();
        config.put("minRows", 5);
        config.put("maxRows", 2);
        assertThatThrownBy(() -> support.validateFieldItem("servers", "table", config))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("maxRows");
    }

    @Test
    void validateFieldItem_tableField_validConfig_passes() {
        assertThatCode(() -> support.validateFieldItem("servers", "table", validTableConfig()))
                .doesNotThrowAnyException();
    }

    // ─── validateAndNormalize: fieldsData 校验 ─────────────────────────────

    @Test
    void validateAndNormalize_nonTableRequiredFieldBlank_enforceTrue_throws() {
        ChangeDocField f = plainField("change_desc", "变更描述", true);
        assertThatThrownBy(() -> support.validateAndNormalize(List.of(f), Map.of(), true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("变更描述");
    }

    @Test
    void validateAndNormalize_nonTableRequiredFieldBlank_enforceFalse_passes() {
        ChangeDocField f = plainField("change_desc", "变更描述", true);
        Map<String, Object> result = support.validateAndNormalize(List.of(f), Map.of(), false);
        assertThat(result).isEmpty();
    }

    @Test
    void validateAndNormalize_scalarDateAndDatetimeValidValues_pass() {
        ChangeDocField date = plainField("window_date", "变更日期", false);
        date.setFieldType("date");
        ChangeDocField datetime = plainField("window_time", "变更时间", false);
        datetime.setFieldType("datetime");

        assertThatCode(() -> support.validateAndNormalize(List.of(date, datetime), Map.of(
                "window_date", "2024-02-29",
                "window_time", "2026-07-17T13:45:30"), false))
                .doesNotThrowAnyException();
    }

    @Test
    void validateAndNormalize_scalarInvalidTemporalValues_throw() {
        ChangeDocField date = plainField("window_date", "变更日期", false);
        date.setFieldType("date");
        ChangeDocField datetime = plainField("window_time", "变更时间", false);
        datetime.setFieldType("datetime");

        assertThatThrownBy(() -> support.validateAndNormalize(List.of(date), Map.of("window_date", "2026-99-99"), false))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("变更日期不是有效日期");
        assertThatThrownBy(() -> support.validateAndNormalize(List.of(datetime), Map.of("window_time", "2026-07-17T13:45+08:00"), false))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("变更时间不是有效日期时间");
    }

    @Test
    void validateAndNormalize_tableField_requiredEmpty_enforceTrue_throws() {
        ChangeDocField f = tableField("servers", "服务器列表", true, validTableConfig());
        assertThatThrownBy(() -> support.validateAndNormalize(List.of(f), Map.of(), true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("至少需要一行数据");
    }

    @Test
    void validateAndNormalize_tableField_requiredEmpty_enforceFalse_passes() {
        ChangeDocField f = tableField("servers", "服务器列表", true, validTableConfig());
        Map<String, Object> result = support.validateAndNormalize(List.of(f), Map.of(), false);
        assertThat((List<?>) result.get("servers")).isEmpty();
    }

    @Test
    void validateAndNormalize_tableField_exceedsMaxRows_throws() {
        Map<String, Object> config = validTableConfig();
        config.put("maxRows", 1);
        ChangeDocField f = tableField("servers", "服务器列表", false, config);
        Map<String, Object> data = new HashMap<>();
        data.put("servers", List.of(dataRow("a"), dataRow("b")));
        assertThatThrownBy(() -> support.validateAndNormalize(List.of(f), data, true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("最多允许 1 行");
    }

    @Test
    void validateAndNormalize_tableField_missingRowId_getsGenerated() {
        ChangeDocField f = tableField("servers", "服务器列表", false, validTableConfig());
        Map<String, Object> data = new HashMap<>();
        Map<String, Object> row = new HashMap<>();
        row.put("name", "srv1");
        data.put("servers", List.of(row));

        Map<String, Object> result = support.validateAndNormalize(List.of(f), data, true);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) result.get("servers");
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0)).containsKey("rowId");
        assertThat((String) rows.get(0).get("rowId")).isNotBlank();
    }

    @Test
    void validateAndNormalize_tableField_columnRequiredBlank_throws() {
        Map<String, Object> config = validTableConfig();
        // "name" 列在 validTableConfig 中 required=true
        ChangeDocField f = tableField("servers", "服务器列表", false, config);
        Map<String, Object> data = new HashMap<>();
        Map<String, Object> row = new HashMap<>();
        row.put("name", "");
        data.put("servers", List.of(row));

        assertThatThrownBy(() -> support.validateAndNormalize(List.of(f), data, true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("名称");
    }

    @Test
    void validateAndNormalize_tableField_selectColumnInvalidOption_throws() {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("tableMode", "fixedDocxTable");
        config.put("allowAddRow", true);
        config.put("allowDeleteRow", true);
        config.put("columns", List.of(selectCol()));
        ChangeDocField f = tableField("servers", "服务器列表", false, config);
        Map<String, Object> data = new HashMap<>();
        Map<String, Object> row = new HashMap<>();
        row.put("status", "invalid_value");
        data.put("servers", List.of(row));

        assertThatThrownBy(() -> support.validateAndNormalize(List.of(f), data, true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("不是有效选项");
    }

    @Test
    void validateAndNormalize_tableField_numberColumnInvalid_throws() {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("tableMode", "fixedDocxTable");
        config.put("allowAddRow", true);
        config.put("allowDeleteRow", true);
        config.put("columns", List.of(col("count", "数量", "number")));
        ChangeDocField f = tableField("servers", "服务器列表", false, config);
        Map<String, Object> data = new HashMap<>();
        Map<String, Object> row = new HashMap<>();
        row.put("count", "not-a-number");
        data.put("servers", List.of(row));

        assertThatThrownBy(() -> support.validateAndNormalize(List.of(f), data, true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("不是有效数字");
    }

    @Test
    void validateAndNormalize_tableField_temporalColumnsValidateCalendarValues() {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("tableMode", "fixedDocxTable");
        config.put("allowAddRow", true);
        config.put("allowDeleteRow", true);
        config.put("columns", List.of(col("date", "日期", "date"), col("datetime", "日期时间", "datetime")));
        ChangeDocField field = tableField("windows", "变更窗口", false, config);
        Map<String, Object> valid = Map.of("windows", List.of(Map.of("date", "2024-02-29", "datetime", "2026-07-17T13:45")));

        assertThatCode(() -> support.validateAndNormalize(List.of(field), valid, false)).doesNotThrowAnyException();
        Map<String, Object> invalid = Map.of("windows", List.of(Map.of("date", "2026-02-29", "datetime", "2026-07-17T25:00")));
        assertThatThrownBy(() -> support.validateAndNormalize(List.of(field), invalid, false))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("不是有效日期");
    }

    @Test
    void validateAndNormalize_tableField_rawValueNotList_throws() {
        ChangeDocField f = tableField("servers", "服务器列表", false, validTableConfig());
        Map<String, Object> data = new HashMap<>();
        data.put("servers", "not-a-list");

        assertThatThrownBy(() -> support.validateAndNormalize(List.of(f), data, true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("数组");
    }

    // ─── helpers ──────────────────────────────────────────────────────────

    private ChangeDocField plainField(String key, String label, boolean required) {
        ChangeDocField f = new ChangeDocField();
        f.setFieldKey(key);
        f.setLabel(label);
        f.setFieldType("textarea");
        f.setRequired(required);
        return f;
    }

    private ChangeDocField tableField(String key, String label, boolean required, Map<String, Object> config) {
        ChangeDocField f = new ChangeDocField();
        f.setFieldKey(key);
        f.setLabel(label);
        f.setFieldType("table");
        f.setRequired(required);
        f.setConfig(config);
        return f;
    }

    private Map<String, Object> validTableConfig() {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("tableMode", "fixedDocxTable");
        config.put("allowAddRow", true);
        config.put("allowDeleteRow", true);
        config.put("columns", List.of(col("name", "名称", "text", true)));
        return config;
    }

    private Map<String, Object> col(String key, String label, String type) {
        return col(key, label, type, false);
    }

    private Map<String, Object> col(String key, String label, String type, boolean required) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("key", key);
        c.put("label", label);
        c.put("type", type);
        c.put("required", required);
        return c;
    }

    private Map<String, Object> selectCol() {
        Map<String, Object> c = col("status", "状态", "select");
        c.put("options", List.of(
                Map.of("value", "ok", "label", "正常"),
                Map.of("value", "bad", "label", "异常")
        ));
        return c;
    }

    private Map<String, Object> dataRow(String name) {
        Map<String, Object> row = new HashMap<>();
        row.put("name", name);
        return row;
    }
}
