package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.service.CiFieldSchemaValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * table 字段类型校验单元测试（spec §4.2a）。覆盖：行类型、必填子列、enum 值域、
 * int 数字校验、系统列 row_id 不强制、对象 schema 与旧裸数组兼容。
 */
class CiFieldSchemaValidatorTableTest {

    private final CiFieldSchemaValidator validator = new CiFieldSchemaValidator(new ObjectMapper());

    private CiAttribute tableAttr(Object schema) {
        CiAttribute a = new CiAttribute();
        a.setFieldKey("nics");
        a.setName("网卡");
        a.setFieldType("table");
        a.setIsRequired(false);
        a.setOption(schema);
        return a;
    }

    private Map<String, Object> objectSchema() {
        return Map.of(
                "schema_version", 1,
                "row_key", "row_id",
                "columns", List.of(
                        Map.of("key", "row_id", "name", "行ID", "type", "singlechar", "system", true, "required", true),
                        Map.of("key", "port", "name", "端口", "type", "singlechar", "required", true),
                        Map.of("key", "speed", "name", "速率", "type", "enum",
                                "options", List.of(Map.of("id", "1g", "name", "1G"), Map.of("id", "10g", "name", "10G"))),
                        Map.of("key", "mtu", "name", "MTU", "type", "int")
                ));
    }

    @Test
    void validRows_pass() {
        CiAttribute attr = tableAttr(objectSchema());
        Map<String, Object> fields = Map.of("nics", List.of(
                mapOf("row_id", "r1", "port", "eth0", "speed", "10g", "mtu", 1500),
                mapOf("row_id", "r2", "port", "eth1", "speed", "1g", "mtu", "9000")
        ));
        assertDoesNotThrow(() -> validator.validate(fields, List.of(attr)));
    }

    @Test
    void nonArrayValue_rejected() {
        CiAttribute attr = tableAttr(objectSchema());
        Map<String, Object> fields = Map.of("nics", "not-an-array");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> validator.validate(fields, List.of(attr)));
        assertTrue(ex.getMessage().contains("表格"));
    }

    @Test
    void missingRequiredSubcolumn_rejected() {
        CiAttribute attr = tableAttr(objectSchema());
        Map<String, Object> fields = Map.of("nics", List.of(mapOf("row_id", "r1", "speed", "1g")));
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> validator.validate(fields, List.of(attr)));
        assertTrue(ex.getMessage().contains("端口"));
    }

    @Test
    void missingRowId_systemColumn_notRequired() {
        // row_id 是 system 列，缺失不应报错（后端补生成）
        CiAttribute attr = tableAttr(objectSchema());
        Map<String, Object> fields = Map.of("nics", List.of(mapOf("port", "eth0")));
        assertDoesNotThrow(() -> validator.validate(fields, List.of(attr)));
    }

    @Test
    void enumOutOfRange_rejected() {
        CiAttribute attr = tableAttr(objectSchema());
        Map<String, Object> fields = Map.of("nics", List.of(mapOf("row_id", "r1", "port", "eth0", "speed", "40g")));
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> validator.validate(fields, List.of(attr)));
        assertTrue(ex.getMessage().contains("可选范围"));
    }

    @Test
    void intSubcolumn_invalid_rejected() {
        CiAttribute attr = tableAttr(objectSchema());
        Map<String, Object> fields = Map.of("nics", List.of(mapOf("row_id", "r1", "port", "eth0", "mtu", "big")));
        assertThrows(IllegalArgumentException.class, () -> validator.validate(fields, List.of(attr)));
    }

    @Test
    void legacyBareArraySchema_compatible() {
        // 旧裸数组 schema（直接当 columns）
        Object bare = List.of(
                Map.of("key", "port", "name", "端口", "type", "singlechar", "required", true));
        CiAttribute attr = tableAttr(bare);
        Map<String, Object> fields = Map.of("nics", List.of(mapOf("port", "eth0")));
        assertDoesNotThrow(() -> validator.validate(fields, List.of(attr)));
    }

    @Test
    void noSchema_tolerated() {
        CiAttribute attr = tableAttr(null);
        Map<String, Object> fields = Map.of("nics", List.of(mapOf("anything", "x")));
        assertDoesNotThrow(() -> validator.validate(fields, List.of(attr)));
    }

    private static Map<String, Object> mapOf(Object... kv) {
        java.util.LinkedHashMap<String, Object> m = new java.util.LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }
}
