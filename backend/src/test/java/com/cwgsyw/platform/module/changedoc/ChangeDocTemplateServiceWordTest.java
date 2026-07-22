package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.module.changedoc.entity.ChangeDocField;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocTemplate;
import com.cwgsyw.platform.common.AuditLogMapper;
import org.apache.poi.xwpf.usermodel.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 见 SPEC §9（parseBookmarks 表格占位符识别）与 §10（fillDocx 表格行复制填充）。
 */
@ExtendWith(MockitoExtension.class)
class ChangeDocTemplateServiceWordTest {

    @Mock ChangeDocTemplateMapper templateMapper;
    @Mock ChangeDocFieldMapper fieldMapper;
    @Mock ChangeDocMapper changeDocMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock MinioStorageService storage;
    @Mock TableFieldSupport tableFieldSupport;

    @InjectMocks ChangeDocTemplateService service;

    private ChangeDocTemplate template() {
        ChangeDocTemplate tpl = new ChangeDocTemplate();
        tpl.setId(1L);
        tpl.setTenantId("default");
        tpl.setDocxKey("templates/1.docx");
        return tpl;
    }

    private void stubTemplate(byte[] docxBytes) {
        when(templateMapper.selectOne(any())).thenReturn(template());
        when(storage.download("templates/1.docx")).thenReturn(new ByteArrayInputStream(docxBytes));
    }

    // ─── parseBookmarks ───────────────────────────────────────────────────

    @Test
    void parseBookmarks_plainPlaceholder_createsTextareaField() throws IOException {
        byte[] docx = buildDocx(doc -> doc.createParagraph().createRun().setText("尊敬的{{applicant_name}}"));
        stubTemplate(docx);
        when(fieldMapper.findByTemplate(1L)).thenReturn(List.of());

        List<String> keys = service.parseBookmarks("default", 1L);

        assertThat(keys).containsExactly("applicant_name");
        ArgumentCaptor<ChangeDocField> captor = ArgumentCaptor.forClass(ChangeDocField.class);
        verify(fieldMapper).insert((ChangeDocField) captor.capture());
        ChangeDocField saved = captor.getValue();
        assertThat(saved.getFieldKey()).isEqualTo("applicant_name");
        assertThat(saved.getFieldType()).isEqualTo("textarea");
    }

    @Test
    void parseBookmarks_tableRow_singleFieldKey_createsTableFieldWithColumns() throws IOException {
        byte[] docx = buildDocx(doc -> {
            XWPFTable table = doc.createTable(2, 2);
            setCellText(table, 0, 0, "姓名");
            setCellText(table, 0, 1, "年龄");
            setCellText(table, 1, 0, "{{servers.name}}");
            setCellText(table, 1, 1, "{{servers.age}}");
        });
        stubTemplate(docx);
        when(fieldMapper.findByTemplate(1L)).thenReturn(List.of());

        List<String> keys = service.parseBookmarks("default", 1L);

        assertThat(keys).contains("servers");
        ArgumentCaptor<ChangeDocField> captor = ArgumentCaptor.forClass(ChangeDocField.class);
        verify(fieldMapper).insert((ChangeDocField) captor.capture());
        ChangeDocField saved = captor.getValue();
        assertThat(saved.getFieldKey()).isEqualTo("servers");
        assertThat(saved.getFieldType()).isEqualTo("table");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> columns = (List<Map<String, Object>>) saved.getConfig().get("columns");
        assertThat(columns).extracting(c -> c.get("key")).containsExactlyInAnyOrder("name", "age");
        assertThat(saved.getConfig().get("tableMode")).isEqualTo("fixedDocxTable");
    }

    @Test
    void parseBookmarks_tableRow_multipleFieldKeysInOneRow_skipped() throws IOException {
        byte[] docx = buildDocx(doc -> {
            XWPFTable table = doc.createTable(1, 2);
            setCellText(table, 0, 0, "{{tableA.x}}");
            setCellText(table, 0, 1, "{{tableB.y}}");
        });
        stubTemplate(docx);
        when(fieldMapper.findByTemplate(1L)).thenReturn(List.of());

        List<String> keys = service.parseBookmarks("default", 1L);

        assertThat(keys).isEmpty();
        verify(fieldMapper, never()).insert(any(ChangeDocField.class));
    }

    // ─── fillDocx ─────────────────────────────────────────────────────────

    @Test
    void fillDocx_plainPlaceholder_replacedWithValue() throws IOException {
        byte[] docx = buildDocx(doc -> doc.createParagraph().createRun().setText("变更标题：{{title}}"));
        stubTemplate(docx);
        when(fieldMapper.findByTemplate(1L)).thenReturn(List.of());

        byte[] filled = service.fillDocx("default", 1L, Map.of("title", "数据库升级"));

        try (XWPFDocument out = new XWPFDocument(new ByteArrayInputStream(filled))) {
            assertThat(out.getParagraphs().get(0).getText()).isEqualTo("变更标题：数据库升级");
        }
    }

    @Test
    void fillDocx_tableField_clonesRowPerDataEntry() throws IOException {
        byte[] docx = buildDocx(doc -> {
            XWPFTable table = doc.createTable(2, 2);
            setCellText(table, 0, 0, "姓名");
            setCellText(table, 0, 1, "年龄");
            setCellText(table, 1, 0, "{{servers.name}}");
            setCellText(table, 1, 1, "{{servers.age}}");
        });
        stubTemplate(docx);

        ChangeDocField field = new ChangeDocField();
        field.setFieldKey("servers");
        field.setFieldType("table");
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("tableMode", "fixedDocxTable");
        List<Map<String, Object>> columns = List.of(
                Map.of("key", "name", "label", "姓名", "type", "text"),
                Map.of("key", "age", "label", "年龄", "type", "text")
        );
        config.put("columns", columns);
        field.setConfig(config);
        when(fieldMapper.findByTemplate(1L)).thenReturn(List.of(field));

        Map<String, Object> data = new HashMap<>();
        data.put("servers", List.of(
                Map.of("name", "张三", "age", "30"),
                Map.of("name", "李四", "age", "25")
        ));

        byte[] filled = service.fillDocx("default", 1L, data);

        try (XWPFDocument out = new XWPFDocument(new ByteArrayInputStream(filled))) {
            XWPFTable table = out.getTables().get(0);
            // 表头 1 行 + 2 条数据行 = 3 行；原模板行被移除
            assertThat(table.getRows()).hasSize(3);
            assertThat(table.getRow(1).getCell(0).getText()).isEqualTo("张三");
            assertThat(table.getRow(1).getCell(1).getText()).isEqualTo("30");
            assertThat(table.getRow(2).getCell(0).getText()).isEqualTo("李四");
            assertThat(table.getRow(2).getCell(1).getText()).isEqualTo("25");
        }
    }

    @Test
    void fillDocx_tableField_emptyData_removesTemplateRowKeepsHeader() throws IOException {
        byte[] docx = buildDocx(doc -> {
            XWPFTable table = doc.createTable(2, 1);
            setCellText(table, 0, 0, "姓名");
            setCellText(table, 1, 0, "{{servers.name}}");
        });
        stubTemplate(docx);

        ChangeDocField field = new ChangeDocField();
        field.setFieldKey("servers");
        field.setFieldType("table");
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("tableMode", "fixedDocxTable");
        config.put("columns", List.of(Map.of("key", "name", "label", "姓名", "type", "text")));
        field.setConfig(config);
        when(fieldMapper.findByTemplate(1L)).thenReturn(List.of(field));

        byte[] filled = service.fillDocx("default", 1L, Map.of());

        try (XWPFDocument out = new XWPFDocument(new ByteArrayInputStream(filled))) {
            XWPFTable table = out.getTables().get(0);
            assertThat(table.getRows()).hasSize(1);
            assertThat(table.getRow(0).getCell(0).getText()).isEqualTo("姓名");
        }
    }

    // ─── helpers ──────────────────────────────────────────────────────────

    private interface DocBuilder {
        void build(XWPFDocument doc);
    }

    private byte[] buildDocx(DocBuilder builder) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            builder.build(doc);
            doc.write(out);
            return out.toByteArray();
        }
    }

    private void setCellText(XWPFTable table, int row, int col, String text) {
        XWPFTableCell cell = table.getRow(row).getCell(col);
        cell.removeParagraph(0);
        cell.addParagraph().createRun().setText(text);
    }
}
