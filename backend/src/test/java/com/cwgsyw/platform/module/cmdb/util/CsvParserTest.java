package com.cwgsyw.platform.module.cmdb.util;

import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

class CsvParserTest {

    private static final String UTF_8 = "UTF-8";

    @Test
    void parseNormalCsv() throws Exception {
        byte[] data = "name,age\nAlice,30\nBob,25\n".getBytes(StandardCharsets.UTF_8);
        List<Map<String, String>> rows = CsvParser.parse(data, UTF_8);
        assertThat(rows).hasSize(2);
        assertThat(rows.get(0)).containsEntry("name", "Alice").containsEntry("age", "30");
        assertThat(rows.get(1)).containsEntry("name", "Bob").containsEntry("age", "25");
    }

    @Test
    void parseNullDataReturnsEmptyList() throws Exception {
        List<Map<String, String>> rows = CsvParser.parse(null, UTF_8);
        assertThat(rows).isEmpty();
    }

    @Test
    void parseEmptyDataReturnsEmptyList() throws Exception {
        List<Map<String, String>> rows = CsvParser.parse(new byte[0], UTF_8);
        assertThat(rows).isEmpty();
    }

    @Test
    void parseBomCsv() throws Exception {
        // BOM bytes: EF BB BF
        byte[] bom = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
        byte[] content = "name,age\nAlice,30\n".getBytes(StandardCharsets.UTF_8);
        byte[] data = new byte[bom.length + content.length];
        System.arraycopy(bom, 0, data, 0, bom.length);
        System.arraycopy(content, 0, data, bom.length, content.length);

        List<Map<String, String>> rows = CsvParser.parse(data, UTF_8);
        assertThat(rows).hasSize(1);
        // Header should not have BOM prefix
        assertThat(rows.get(0)).containsEntry("name", "Alice");
    }

    @Test
    void parseExceedsMaxRowsThrows() {
        // Build CSV with 5000 data rows (5001 lines including header)
        StringBuilder sb = new StringBuilder("header\n");
        for (int i = 0; i < 5000; i++) {
            sb.append("row").append(i).append("\n");
        }
        byte[] data = sb.toString().getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> CsvParser.parse(data, UTF_8))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("5000");
    }

    @Test
    void parseMaxRowsAllowed() throws Exception {
        // Build CSV with 4999 data rows (5000 lines including header) — should pass
        StringBuilder sb = new StringBuilder("header\n");
        for (int i = 0; i < 4999; i++) {
            sb.append("row").append(i).append("\n");
        }
        byte[] data = sb.toString().getBytes(StandardCharsets.UTF_8);

        List<Map<String, String>> rows = CsvParser.parse(data, UTF_8);
        assertThat(rows).hasSize(4999);
    }
}
