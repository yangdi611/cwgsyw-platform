package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.module.cmdb.service.JsonImportService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * JSON/NDJSON 批量导入纯逻辑单元测试（spec §7）：解析、字段提取、mode 归一化。
 * （preview/execute 的 DB/Redis 路径需集成环境，此处只覆盖确定性逻辑。）
 */
class JsonImportServiceTest {

    private final JsonImportService service =
            new JsonImportService(null, null, null, null, null, new ObjectMapper());

    @Test
    void parseNdjson_multiLine() {
        String ndjson = "{\"name\":\"web-01\",\"cpu_cores\":32}\n{\"name\":\"web-02\"}";
        List<Map<String, Object>> rows = service.parseContent(ndjson);
        assertEquals(2, rows.size());
        assertEquals("web-01", rows.get(0).get("name"));
        assertEquals(32, ((Number) rows.get(0).get("cpu_cores")).intValue());
    }

    @Test
    void parseNdjson_skipsBlankLines() {
        String ndjson = "{\"name\":\"a\"}\n\n  \n{\"name\":\"b\"}\n";
        List<Map<String, Object>> rows = service.parseContent(ndjson);
        assertEquals(2, rows.size());
    }

    @Test
    void parseJsonArray() {
        String arr = "[{\"name\":\"a\"},{\"name\":\"b\"},{\"name\":\"c\"}]";
        List<Map<String, Object>> rows = service.parseContent(arr);
        assertEquals(3, rows.size());
    }

    @Test
    void parseNdjson_badLine_reportsLineNumber() {
        String ndjson = "{\"name\":\"a\"}\nnot-json";
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.parseContent(ndjson));
        assertTrue(ex.getMessage().contains("第 2 行"));
    }

    @Test
    void extractFields_removesTopLevelAndSystemKeys() {
        Map<String, Object> row = new java.util.LinkedHashMap<>();
        row.put("_action", "create");
        row.put("_modelId", "host");
        row.put("_existingId", 5L);
        row.put("name", "web-01");
        row.put("status", "online");
        row.put("owner", "ops");
        row.put("description", "d");
        row.put("cpu_cores", 32);
        row.put("nics", List.of(Map.of("row_id", "r1", "port", "eth0")));

        Map<String, Object> fields = service.extractFields(row);
        assertTrue(fields.containsKey("cpu_cores"));
        assertTrue(fields.containsKey("nics"));
        assertFalse(fields.containsKey("name"));
        assertFalse(fields.containsKey("status"));
        assertFalse(fields.containsKey("_action"));
        assertFalse(fields.containsKey("_modelId"));
        assertFalse(fields.containsKey("_existingId"));
    }

    @Test
    void normalizeMode_validAndInvalid() {
        assertEquals("merge", service.normalizeMode(null));
        assertEquals("merge", service.normalizeMode("merge"));
        assertEquals("replace_fields", service.normalizeMode("replace_fields"));
        assertEquals("baseline_replace", service.normalizeMode("baseline_replace"));
        assertThrows(IllegalArgumentException.class, () -> service.normalizeMode("bogus"));
    }
}
