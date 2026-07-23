package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.module.changedoc.dto.ChangeDocVO;
import com.cwgsyw.platform.module.changedoc.dto.FieldConfigVO;
import com.cwgsyw.platform.module.config.SysConfigService;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
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

    @Test
    void exportPdfDirect_readsConfiguredWatermarkAngle() {
        SysConfigService configService = mock(SysConfigService.class);
        when(configService.get("default", "watermark.enabled")).thenReturn("true");
        when(configService.get("default", "watermark.text")).thenReturn("FQA");
        when(configService.get("default", "watermark.opacity")).thenReturn("0.5");
        when(configService.get("default", "watermark.angle")).thenReturn("-30");
        ExportService service = new ExportService(configService, mock(ChangeDocTemplateService.class));

        byte[] exported = service.exportPdfDirect(new ChangeDocVO(), "default");

        assertThat(exported).startsWith("%PDF".getBytes());
        verify(configService).get("default", "watermark.angle");
    }

    @Test
    void approvedProgrammaticExportsIncludeStatusAndSelectedTemplateTable() throws Exception {
        ChangeDocTemplateService templateService = mock(ChangeDocTemplateService.class);
        when(templateService.fillDocx("default", 4L, Map.of("servers", rows())))
                .thenThrow(new IllegalStateException("请先上传模板文件"));
        SysConfigService configService = mock(SysConfigService.class);
        when(configService.get("default", "watermark.enabled")).thenReturn("false");
        ExportService service = new ExportService(configService, templateService);
        ChangeDocVO doc = document(rows());
        doc.setStatus("approved");
        doc.setApproverName("approver-remp1075");
        doc.setApprovedAt(LocalDateTime.of(2026, 7, 22, 1, 2));
        doc.setApproverComment("approval-comment-remp1075");

        byte[] docx = service.exportDocxFor(doc, "default", 4L);
        try (XWPFDocument output = new XWPFDocument(new ByteArrayInputStream(docx))) {
            assertThat(output.getParagraphs().stream().map(p -> p.getText()).toList())
                    .anyMatch(text -> text.contains("审批状态：审批通过 (approved)"));
        }

        byte[] pdf = service.exportPdfDirect(doc, "default", 4L);
        PdfReader reader = new PdfReader(pdf);
        PdfTextExtractor extractor = new PdfTextExtractor(reader);
        String text = extractor.getTextFromPage(1) + "\n" + extractor.getTextFromPage(2);
        reader.close();
        assertThat(text).contains("approver-remp1075", "approval-comment-remp1075");
        assertThat(text).contains("first", "second", "third");
        assertThat(text.indexOf("first")).isLessThan(text.indexOf("second"));
    }

    @Test
    void pdfExportsOnlyTheSelectedTemplateTableWithDisplayValues() throws Exception {
        SysConfigService configService = mock(SysConfigService.class);
        when(configService.get("default", "watermark.enabled")).thenReturn("false");
        ExportService service = new ExportService(configService, mock(ChangeDocTemplateService.class));
        ChangeDocVO doc = new ChangeDocVO();
        doc.setApplicationTemplateId(4L);
        doc.setPlanTemplateId(5L);
        doc.setApplicationFieldConfig(List.of(tableField("application_rows", "application_name")));
        doc.setPlanFieldConfig(List.of(tableField("plan_rows", "plan_name")));
        doc.setFieldsData(Map.of(
                "application_rows", List.of(new LinkedHashMap<>(Map.of(
                        "name", "application-only", "enabled", true, "kind", "primary"))),
                "plan_rows", List.of(new LinkedHashMap<>(Map.of(
                        "name", "plan-only", "enabled", false, "kind", "secondary")))
        ));

        String applicationText = pdfText(service.exportPdfDirect(doc, "default", 4L));
        String planText = pdfText(service.exportPdfDirect(doc, "default", 5L));

        assertThat(applicationText).contains("application-only", "application_name", "Primary label");
        assertThat(applicationText).doesNotContain("plan-only", "plan_name", "Secondary label");
        assertThat(planText).contains("plan-only", "plan_name", "Secondary label");
        assertThat(planText).doesNotContain("application-only", "application_name", "Primary label");
    }

    private ChangeDocVO document(List<LinkedHashMap<String, Object>> rows) {
        FieldConfigVO field = tableField("servers", "服务器清单");
        ChangeDocVO doc = new ChangeDocVO();
        doc.setFieldsData(Map.of("servers", rows));
        doc.setApplicationTemplateId(4L);
        doc.setApplicationFieldConfig(List.of(field));
        return doc;
    }

    private FieldConfigVO tableField(String fieldKey, String label) {
        FieldConfigVO field = new FieldConfigVO();
        field.setFieldKey(fieldKey);
        field.setLabel(label);
        field.setFieldType("table");
        field.setConfig(Map.of(
                "tableMode", "fixedDocxTable",
                "columns", List.of(
                        Map.of("key", "name", "label", "主机", "type", "text"),
                        Map.of("key", "enabled", "label", "启用", "type", "checkbox"),
                        Map.of("key", "kind", "label", "类型", "type", "select", "options", List.of(
                                Map.of("value", "primary", "label", "Primary label"),
                                Map.of("value", "secondary", "label", "Secondary label")))
                )
        ));
        return field;
    }

    private String pdfText(byte[] pdf) throws Exception {
        PdfReader reader = new PdfReader(pdf);
        try {
            PdfTextExtractor extractor = new PdfTextExtractor(reader);
            StringBuilder text = new StringBuilder();
            for (int page = 1; page <= reader.getNumberOfPages(); page++) {
                text.append(extractor.getTextFromPage(page)).append('\n');
            }
            return text.toString();
        } finally {
            reader.close();
        }
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
