package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.module.changedoc.dto.ChangeDocVO;
import com.cwgsyw.platform.module.changedoc.dto.FieldConfigVO;
import com.cwgsyw.platform.module.config.SysConfigService;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ExportServiceTest {

    @Test
    void exportDocxFor_programmaticFallbackRendersFixedTableRowsInStoredOrder() throws Exception {
        ChangeDocTemplateService templateService = mock(ChangeDocTemplateService.class);
        when(templateService.fillDocx("default", 4L, Map.of("servers", rows()))).thenThrow(new IllegalStateException("请先上传模板文件"));
        ExportService service = new ExportService(mock(SysConfigService.class), templateService);
        ChangeDocVO doc = document(rows());

        byte[] exported = service.exportDocxFor(doc, "default", 4L);

        try (XWPFDocument output = new XWPFDocument(new ByteArrayInputStream(exported))) {
            XWPFTable table = output.getTables().get(0);
            assertThat(table.getRows()).hasSize(4);
            assertThat(table.getRow(0).getCell(0).getText()).isEqualTo("主机");
            assertThat(table.getRow(0).getCell(1).getText()).isEqualTo("启用");
            assertThat(table.getRow(1).getCell(0).getText()).isEqualTo("first");
            assertThat(table.getRow(1).getCell(1).getText()).isEqualTo("否");
            assertThat(table.getRow(2).getCell(0).getText()).isEqualTo("second");
            assertThat(table.getRow(2).getCell(1).getText()).isEqualTo("是");
            assertThat(table.getRow(3).getCell(0).getText()).isEqualTo("third");
            assertThat(table.getRow(3).getCell(1).getText()).isEqualTo("否");
        }
    }

    @Test
    void exportDocxFor_programmaticFallbackKeepsHeaderForEmptyFixedTable() throws Exception {
        ChangeDocTemplateService templateService = mock(ChangeDocTemplateService.class);
        when(templateService.fillDocx("default", 4L, Map.of("servers", List.of()))).thenThrow(new IllegalStateException("请先上传模板文件"));
        ExportService service = new ExportService(mock(SysConfigService.class), templateService);
        ChangeDocVO doc = document(List.of());

        byte[] exported = service.exportDocxFor(doc, "default", 4L);

        try (XWPFDocument output = new XWPFDocument(new ByteArrayInputStream(exported))) {
            XWPFTable table = output.getTables().get(0);
            assertThat(table.getRows()).hasSize(1);
            assertThat(table.getRow(0).getCell(0).getText()).isEqualTo("主机");
            assertThat(table.getRow(0).getCell(1).getText()).isEqualTo("启用");
        }
    }

    private ChangeDocVO document(List<LinkedHashMap<String, Object>> rows) {
        FieldConfigVO field = new FieldConfigVO();
        field.setFieldKey("servers");
        field.setLabel("服务器清单");
        field.setFieldType("table");
        field.setConfig(Map.of(
                "tableMode", "fixedDocxTable",
                "columns", List.of(
                        Map.of("key", "name", "label", "主机", "type", "text"),
                        Map.of("key", "enabled", "label", "启用", "type", "checkbox")
                )
        ));
        ChangeDocVO doc = new ChangeDocVO();
        doc.setFieldsData(Map.of("servers", rows));
        doc.setApplicationFieldConfig(List.of(field));
        return doc;
    }

    private List<LinkedHashMap<String, Object>> rows() {
        LinkedHashMap<String, Object> first = new LinkedHashMap<>();
        first.put("name", "first");
        first.put("enabled", false);
        LinkedHashMap<String, Object> second = new LinkedHashMap<>();
        second.put("name", "second");
        second.put("enabled", true);
        LinkedHashMap<String, Object> third = new LinkedHashMap<>();
        third.put("name", "third");
        third.put("enabled", false);
        return List.of(first, second, third);
    }
}
