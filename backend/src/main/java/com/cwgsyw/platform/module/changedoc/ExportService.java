package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.module.changedoc.dto.ChangeDocVO;
import com.cwgsyw.platform.module.changedoc.dto.FieldConfigVO;
import com.cwgsyw.platform.module.config.SysConfigService;
import com.lowagie.text.*;
import java.util.Map;
import com.lowagie.text.pdf.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPageMar;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.LinkedHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {

    private final SysConfigService configService;
    private final ChangeDocTemplateService templateService;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    public byte[] exportDocx(ChangeDocVO doc, String tenantId) {
        // Use application template .docx if available
        Long templateIdForExport = doc.getApplicationTemplateId() != null
                ? doc.getApplicationTemplateId()
                : doc.getPlanTemplateId();
        return exportDocxFor(doc, tenantId, templateIdForExport);
    }

    /**
     * 用指定模板导出。如果模板有 .docx 文件就用模板填充；否则回退到程序化生成。
     * 双导出场景下，{@code templateId} 必须明确传入（application 或 plan 之一）。
     */
    public byte[] exportDocxFor(ChangeDocVO doc, String tenantId, Long templateId) {
        if (templateId != null) {
            try {
                return templateService.fillDocx(tenantId, templateId,
                        doc.getFieldsData() != null ? doc.getFieldsData() : Map.of());
            } catch (IllegalStateException e) {
                // Template has no .docx file yet — fall through to programmatic generation
            }
        }
        return exportDocxProgrammatic(doc, templateId);
    }

    private byte[] exportDocxProgrammatic(ChangeDocVO doc, Long templateId) {
        try (XWPFDocument xdoc = buildDocument(doc, templateId);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            xdoc.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("生成 Word 文档失败: " + e.getMessage(), e);
        }
    }

    public byte[] exportPdfDirect(ChangeDocVO doc, String tenantId) {
        Long templateId = doc.getApplicationTemplateId() != null
                ? doc.getApplicationTemplateId()
                : doc.getPlanTemplateId();
        return exportPdfDirect(doc, tenantId, templateId);
    }

    public byte[] exportPdfDirect(ChangeDocVO doc, String tenantId, Long templateId) {
        boolean wmEnabled = !"false".equals(configService.get(tenantId, "watermark.enabled"));
        String wmText    = configService.get(tenantId, "watermark.text");
        float  wmOpacity = parseFloat(configService.get(tenantId, "watermark.opacity"), 0.15f);
        float  wmAngle   = parseFloat(configService.get(tenantId, "watermark.angle"),   45f);
        float  wmSize    = 36f;
        if (wmText == null || wmText.isBlank()) wmText = "IT运维平台";

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            com.lowagie.text.Document pdf = new com.lowagie.text.Document(PageSize.A4, 72, 72, 90, 72);
            PdfWriter.getInstance(pdf, out);
            pdf.open();

            String cjkFontPath = findCjkFont();
            com.lowagie.text.Font titleFont   = loadFont(cjkFontPath, 18, com.lowagie.text.Font.BOLD);
            com.lowagie.text.Font headingFont = loadFont(cjkFontPath, 12, com.lowagie.text.Font.BOLD);
            com.lowagie.text.Font labelFont   = loadFont(cjkFontPath, 11, com.lowagie.text.Font.BOLD);
            com.lowagie.text.Font bodyFont    = loadFont(cjkFontPath, 11, com.lowagie.text.Font.NORMAL);

            pdf.add(new Paragraph("变更申请单", titleFont));
            pdf.add(Chunk.NEWLINE);
            addPdfField(pdf, "变更编号", doc.getChangeNo(), labelFont, bodyFont);
            addPdfField(pdf, "申请人",   doc.getApplicantName(), labelFont, bodyFont);
            addPdfField(pdf, "申请时间", doc.getApplyTime() != null ? doc.getApplyTime().format(FMT) : "", labelFont, bodyFont);
            addPdfField(pdf, "变更标题", fieldOf(doc, "title"), labelFont, bodyFont);
            addPdfField(pdf, "变更内容描述", fieldOf(doc, "change_desc"), labelFont, bodyFont);
            addPdfField(pdf, "影响范围",     fieldOf(doc, "impact_scope"), labelFont, bodyFont);
            addPdfField(pdf, "变更时间窗口", fieldOf(doc, "change_window"), labelFont, bodyFont);
            addPdfField(pdf, "资源支持说明", fieldOf(doc, "resource_support"), labelFont, bodyFont);
            addPdfField(pdf, "审批状态", approvalStatus(doc.getStatus()), labelFont, bodyFont);
            if ("approved".equals(doc.getStatus())) {
                addPdfField(pdf, "审批人",   doc.getApproverName(), labelFont, bodyFont);
                addPdfField(pdf, "审批时间", doc.getApprovedAt() != null ? doc.getApprovedAt().format(FMT) : "", labelFont, bodyFont);
                addPdfField(pdf, "审批意见", doc.getApproverComment(), labelFont, bodyFont);
            } else {
                addPdfField(pdf, "审批签字", "", labelFont, bodyFont);
                addPdfField(pdf, "审批日期", "", labelFont, bodyFont);
            }

            pdf.newPage();
            pdf.add(new Paragraph("变更方案", titleFont));
            pdf.add(Chunk.NEWLINE);
            addPdfSection(pdf, "一、背景与目的",         fieldOf(doc, "background"), headingFont, bodyFont);
            addPdfSection(pdf, "二、详细操作步骤",       fieldOf(doc, "steps"), headingFont, bodyFont);
            addPdfSection(pdf, "三、风险评估与应对措施", fieldOf(doc, "risk_assessment"), headingFont, bodyFont);
            addPdfSection(pdf, "四、回滚计划",           fieldOf(doc, "rollback_plan"), headingFont, bodyFont);
            addPdfSection(pdf, "五、验证方法",           fieldOf(doc, "verify_method"), headingFont, bodyFont);
            addPdfSection(pdf, "六、相关人员联系方式",   fieldOf(doc, "contacts"), headingFont, bodyFont);
            addPdfDynamicTables(pdf, doc, templateId, labelFont, bodyFont);

            pdf.close();
            byte[] pdfBytes = out.toByteArray();
            return wmEnabled
                    ? addWatermarkToPdf(pdfBytes, wmText, wmOpacity, wmAngle, wmSize, cjkFontPath)
                    : pdfBytes;
        } catch (Exception e) {
            throw new RuntimeException("生成 PDF 失败: " + e.getMessage(), e);
        }
    }

    private XWPFDocument buildDocument(ChangeDocVO doc, Long templateId) {
        XWPFDocument xdoc = new XWPFDocument();
        setPageMargins(xdoc);

        addTitle(xdoc, "变更申请单");
        addField(xdoc, "变更编号", doc.getChangeNo());
        addField(xdoc, "申请人",   doc.getApplicantName());
        addField(xdoc, "申请时间", doc.getApplyTime() != null ? doc.getApplyTime().format(FMT) : "");
        addField(xdoc, "变更标题", fieldOf(doc, "title"));
        addField(xdoc, "变更内容描述", fieldOf(doc, "change_desc"));
        addField(xdoc, "影响范围",     fieldOf(doc, "impact_scope"));
        addField(xdoc, "变更时间窗口", fieldOf(doc, "change_window"));
        addField(xdoc, "资源支持说明", fieldOf(doc, "resource_support"));
        addField(xdoc, "审批状态", approvalStatus(doc.getStatus()));

        if ("approved".equals(doc.getStatus())) {
            addField(xdoc, "审批人",   doc.getApproverName());
            addField(xdoc, "审批时间", doc.getApprovedAt() != null ? doc.getApprovedAt().format(FMT) : "");
            addField(xdoc, "审批意见", doc.getApproverComment());
        } else {
            addField(xdoc, "审批签字", "");
            addField(xdoc, "审批日期", "");
        }

        addPageBreak(xdoc);

        addTitle(xdoc, "变更方案");
        addSection(xdoc, "一、背景与目的",         fieldOf(doc, "background"));
        addSection(xdoc, "二、详细操作步骤",       fieldOf(doc, "steps"));
        addSection(xdoc, "三、风险评估与应对措施", fieldOf(doc, "risk_assessment"));
        addSection(xdoc, "四、回滚计划",           fieldOf(doc, "rollback_plan"));
        addSection(xdoc, "五、验证方法",           fieldOf(doc, "verify_method"));
        addSection(xdoc, "六、相关人员联系方式",   fieldOf(doc, "contacts"));
        addDynamicTables(xdoc, doc, templateId);

        return xdoc;
    }

    private void addDynamicTables(XWPFDocument xdoc, ChangeDocVO doc, Long templateId) {
        List<FieldConfigVO> fields = fieldsForTemplate(doc, templateId);
        addDynamicTables(xdoc, fields, doc.getFieldsData());
    }

    private void addPdfDynamicTables(com.lowagie.text.Document pdf, ChangeDocVO doc, Long templateId,
                                     com.lowagie.text.Font headingFont,
                                     com.lowagie.text.Font bodyFont) throws DocumentException {
        List<FieldConfigVO> fields = fieldsForTemplate(doc, templateId);
        if (fields == null || doc.getFieldsData() == null) return;
        for (FieldConfigVO field : fields) {
            if (!isFixedDocxTable(field)) continue;
            List<Map<String, Object>> columns = columns(field);
            if (columns.isEmpty()) continue;
            Paragraph heading = new Paragraph(
                    (field.getLabel() == null || field.getLabel().isBlank() ? "表格" : field.getLabel()) + "：",
                    headingFont);
            heading.setSpacingBefore(10);
            heading.setSpacingAfter(4);
            pdf.add(heading);
            PdfPTable table = new PdfPTable(columns.size());
            table.setWidthPercentage(100);
            for (Map<String, Object> column : columns) {
                table.addCell(pdfTableCell(tableColumnLabel(column), headingFont));
            }
            for (LinkedHashMap<String, Object> row : tableRows(doc.getFieldsData().get(field.getFieldKey()))) {
                for (Map<String, Object> column : columns) {
                    table.addCell(pdfTableCell(
                            tableCellValue(column, row.get(tableColumnKey(column))), bodyFont));
                }
            }
            pdf.add(table);
        }
    }

    private PdfPCell pdfTableCell(String value, com.lowagie.text.Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(value == null ? "" : stripHtml(value), font));
        cell.setPadding(4);
        return cell;
    }

    private List<FieldConfigVO> fieldsForTemplate(ChangeDocVO doc, Long templateId) {
        return templateId != null && templateId.equals(doc.getPlanTemplateId())
                ? doc.getPlanFieldConfig()
                : doc.getApplicationFieldConfig();
    }

    private String approvalStatus(String status) {
        if (status == null) return "";
        return switch (status) {
            case "draft" -> "草稿 (draft)";
            case "pending" -> "待审批 (pending)";
            case "approved" -> "审批通过 (approved)";
            case "rejected" -> "已驳回 (rejected)";
            default -> status;
        };
    }

    private void addDynamicTables(XWPFDocument xdoc, List<FieldConfigVO> fields, Map<String, Object> fieldsData) {
        if (fields == null || fieldsData == null) return;
        for (FieldConfigVO field : fields) {
            if (!isFixedDocxTable(field)) continue;
            List<LinkedHashMap<String, Object>> rows = tableRows(fieldsData.get(field.getFieldKey()));
            addTableHeading(xdoc, field.getLabel());
            addTable(xdoc, columns(field), rows);
        }
    }

    private boolean isFixedDocxTable(FieldConfigVO field) {
        return "table".equals(field.getFieldType())
                && field.getConfig() != null
                && "fixedDocxTable".equals(field.getConfig().get("tableMode"));
    }

    @SuppressWarnings("unchecked")
    private List<LinkedHashMap<String, Object>> tableRows(Object rawRows) {
        if (!(rawRows instanceof List<?> rows)) return List.of();
        return rows.stream()
                .filter(Map.class::isInstance)
                .map(row -> new LinkedHashMap<>((Map<String, Object>) row))
                .toList();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> columns(FieldConfigVO field) {
        Object rawColumns = field.getConfig().get("columns");
        if (!(rawColumns instanceof List<?> columns)) return List.of();
        return columns.stream()
                .filter(Map.class::isInstance)
                .map(column -> (Map<String, Object>) column)
                .toList();
    }

    private void addTableHeading(XWPFDocument xdoc, String label) {
        XWPFParagraph paragraph = xdoc.createParagraph();
        paragraph.setSpacingBefore(200);
        paragraph.setSpacingAfter(100);
        XWPFRun run = paragraph.createRun();
        run.setText((label == null || label.isBlank() ? "表格" : label) + "：");
        run.setBold(true);
        run.setFontFamily("宋体");
        run.setFontSize(12);
    }

    private void addTable(XWPFDocument xdoc, List<Map<String, Object>> columns,
                          List<LinkedHashMap<String, Object>> rows) {
        if (columns.isEmpty()) return;
        XWPFTable table = xdoc.createTable(1, columns.size());
        for (int columnIndex = 0; columnIndex < columns.size(); columnIndex++) {
            writeTableCell(table.getRow(0).getCell(columnIndex), tableColumnLabel(columns.get(columnIndex)));
        }
        for (LinkedHashMap<String, Object> row : rows) {
            XWPFTableRow tableRow = table.createRow();
            for (int columnIndex = 0; columnIndex < columns.size(); columnIndex++) {
                Map<String, Object> column = columns.get(columnIndex);
                writeTableCell(tableRow.getCell(columnIndex), tableCellValue(column, row.get(tableColumnKey(column))));
            }
        }
    }

    private String tableColumnKey(Map<String, Object> column) {
        Object key = column.get("key");
        return key instanceof String value ? value : "";
    }

    private String tableColumnLabel(Map<String, Object> column) {
        Object label = column.get("label");
        return label instanceof String value && !value.isBlank() ? value : tableColumnKey(column);
    }

    private String tableCellValue(Map<String, Object> column, Object value) {
        if (value == null) return "";
        if (value instanceof Boolean booleanValue) return booleanValue ? "是" : "否";
        if ("select".equals(column.get("type"))) {
            Object options = column.get("options");
            if (options instanceof List<?> optionList) {
                for (Object option : optionList) {
                    if (option instanceof Map<?, ?> optionMap
                            && String.valueOf(value).equals(String.valueOf(optionMap.get("value")))) {
                        Object label = optionMap.get("label");
                        return label == null ? String.valueOf(value) : String.valueOf(label);
                    }
                }
            }
        }
        return String.valueOf(value);
    }

    private void writeTableCell(XWPFTableCell cell, String value) {
        XWPFParagraph paragraph = cell.getParagraphs().get(0);
        XWPFRun run = paragraph.createRun();
        run.setFontFamily("宋体");
        run.setFontSize(10);
        writeMultiline(run, value);
    }

    private void setPageMargins(XWPFDocument xdoc) {
        CTPageMar mar = xdoc.getDocument().getBody().addNewSectPr().addNewPgMar();
        mar.setTop(BigInteger.valueOf(1440));
        mar.setBottom(BigInteger.valueOf(1440));
        mar.setLeft(BigInteger.valueOf(1800));
        mar.setRight(BigInteger.valueOf(1440));
    }

    private void addTitle(XWPFDocument xdoc, String text) {
        XWPFParagraph p = xdoc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER);
        p.setSpacingAfter(200);
        XWPFRun run = p.createRun();
        run.setText(text);
        run.setBold(true);
        run.setFontSize(18);
        run.setFontFamily("宋体");
    }

    private void addField(XWPFDocument xdoc, String label, String value) {
        XWPFParagraph p = xdoc.createParagraph();
        p.setSpacingAfter(100);
        XWPFRun labelRun = p.createRun();
        labelRun.setText(label + "：");
        labelRun.setBold(true);
        labelRun.setFontFamily("宋体");
        labelRun.setFontSize(11);
        XWPFRun valueRun = p.createRun();
        valueRun.setFontFamily("宋体");
        valueRun.setFontSize(11);
        writeMultiline(valueRun, value != null ? stripHtml(value) : "");
    }

    private void addSection(XWPFDocument xdoc, String heading, String content) {
        XWPFParagraph hp = xdoc.createParagraph();
        hp.setSpacingBefore(200);
        hp.setSpacingAfter(100);
        XWPFRun hr = hp.createRun();
        hr.setText(heading);
        hr.setBold(true);
        hr.setFontFamily("宋体");
        hr.setFontSize(12);
        XWPFParagraph cp = xdoc.createParagraph();
        cp.setSpacingAfter(100);
        XWPFRun cr = cp.createRun();
        cr.setFontFamily("宋体");
        cr.setFontSize(11);
        writeMultiline(cr, content != null ? stripHtml(content) : "（暂无内容）");
    }

    /** 把多行文本写入单个 XWPFRun：第一行 setText，后续每行 addBreak + setText。保留 run 的字体/字号样式。 */
    private void writeMultiline(XWPFRun run, String text) {
        String normalized = text.replace("\r\n", "\n").replace('\r', '\n');
        String[] lines = normalized.split("\n", -1);
        run.setText(lines[0], 0);
        for (int i = 1; i < lines.length; i++) {
            run.addBreak(BreakType.TEXT_WRAPPING);
            run.setText(lines[i]);
        }
    }

    private void addPageBreak(XWPFDocument xdoc) {
        XWPFParagraph p = xdoc.createParagraph();
        p.createRun().addBreak(BreakType.PAGE);
    }

    private void addPdfField(com.lowagie.text.Document pdf, String label, String value,
                              com.lowagie.text.Font labelFont, com.lowagie.text.Font bodyFont) throws DocumentException {
        Paragraph p = new Paragraph();
        p.add(new Chunk(label + "：", labelFont));
        addMultilineChunks(p, value != null ? stripHtml(value) : "", bodyFont);
        p.setSpacingAfter(6);
        pdf.add(p);
    }

    private void addPdfSection(com.lowagie.text.Document pdf, String heading, String content,
                                com.lowagie.text.Font headingFont, com.lowagie.text.Font bodyFont) throws DocumentException {
        Paragraph h = new Paragraph(heading, headingFont);
        h.setSpacingBefore(10);
        h.setSpacingAfter(4);
        pdf.add(h);
        Paragraph c = new Paragraph();
        addMultilineChunks(c, content != null ? stripHtml(content) : "（暂无内容）", bodyFont);
        c.setSpacingAfter(8);
        pdf.add(c);
    }

    private byte[] addWatermarkToPdf(byte[] pdfBytes, String text, float opacity, float angle, float fontSize, String cjkFontPath) {
        try {
            PdfReader reader = new PdfReader(new ByteArrayInputStream(pdfBytes));
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            PdfStamper stamper = new PdfStamper(reader, out);
            BaseFont bf;
            if (cjkFontPath != null) {
                try {
                    bf = BaseFont.createFont(cjkFontPath, BaseFont.IDENTITY_H, BaseFont.EMBEDDED);
                } catch (Exception e) {
                    log.warn("Failed to load CJK font for watermark, falling back to Helvetica: {}", e.getMessage());
                    bf = BaseFont.createFont(BaseFont.HELVETICA, BaseFont.WINANSI, BaseFont.NOT_EMBEDDED);
                }
            } else {
                bf = BaseFont.createFont(BaseFont.HELVETICA, BaseFont.WINANSI, BaseFont.NOT_EMBEDDED);
            }
            int pages = reader.getNumberOfPages();
            for (int i = 1; i <= pages; i++) {
                PdfContentByte canvas = stamper.getUnderContent(i);
                canvas.saveState();
                PdfGState gs = new PdfGState();
                gs.setFillOpacity(opacity);
                canvas.setGState(gs);
                canvas.setColorFill(Color.GRAY);
                canvas.beginText();
                canvas.setFontAndSize(bf, fontSize);
                Rectangle pageSize = reader.getPageSize(i);
                float x = pageSize.getWidth() / 2;
                float y = pageSize.getHeight() / 2;
                canvas.showTextAligned(Element.ALIGN_CENTER, text, x, y, angle);
                canvas.showTextAligned(Element.ALIGN_CENTER, text, x - 150, y - 150, angle);
                canvas.showTextAligned(Element.ALIGN_CENTER, text, x + 150, y + 150, angle);
                canvas.endText();
                canvas.restoreState();
            }
            stamper.close();
            reader.close();
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("添加水印失败: " + e.getMessage(), e);
        }
    }

    private String findCjkFont() {
        String[] candidates = {
            "/usr/share/fonts/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/noto/NotoSerifCJK-Regular.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/opentype/noto/NotoSerifCJKsc-Regular.otf",
        };
        for (String path : candidates) {
            if (new java.io.File(path).exists()) {
                log.info("Using CJK font: {}", path);
                return path;
            }
        }
        log.warn("No CJK font found; Chinese characters may not render in PDF");
        return null;
    }

    private com.lowagie.text.Font loadFont(String fontPath, float size, int style) {
        if (fontPath == null) {
            return new com.lowagie.text.Font(com.lowagie.text.Font.HELVETICA, size, style);
        }
        try {
            BaseFont bf = BaseFont.createFont(fontPath, BaseFont.IDENTITY_H, BaseFont.EMBEDDED);
            return new com.lowagie.text.Font(bf, size, style);
        } catch (Exception e) {
            log.warn("Failed to load CJK font from {}: {}", fontPath, e.getMessage());
            return new com.lowagie.text.Font(com.lowagie.text.Font.HELVETICA, size, style);
        }
    }

    /**
     * 从 fieldsData 安全读取一个普通字段值并格式化为字符串。
     * 表格字段（List/Map）不是普通字段的展示对象，程序化生成/PDF 场景下降级为空字符串，避免报错。
     * 见 SPEC §4.3（PDF 不作为本次表格验收范围，但不能因数组值抛异常）、§10.8（普通字段格式化规则）。
     */
    private String fieldOf(ChangeDocVO doc, String key) {
        if (doc.getFieldsData() == null) return "";
        Object v = doc.getFieldsData().get(key);
        return formatFieldValue(v);
    }

    private String formatFieldValue(Object v) {
        if (v == null) return "";
        if (v instanceof String s) return s;
        if (v instanceof Boolean b) return b ? "是" : "否";
        if (v instanceof java.util.List || v instanceof java.util.Map) return "";
        return v.toString();
    }

    /** PDF：把多行文本按 \n 切分成 Chunk + Chunk.NEWLINE，保留 paragraph 已有的样式属性。 */
    private void addMultilineChunks(Paragraph para, String text, com.lowagie.text.Font font) {
        if (text == null) text = "";
        String normalized = text.replace("\r\n", "\n").replace('\r', '\n');
        String[] lines = normalized.split("\n", -1);
        for (int i = 0; i < lines.length; i++) {
            if (i > 0) para.add(Chunk.NEWLINE);
            para.add(new Chunk(lines[i], font));
        }
    }

    private String stripHtml(String html) {
        if (html == null) return "";
        // 先把 <br> / <p> 等块级换行转成 \n，再剥其他标签
        return html.replaceAll("(?i)<br\\s*/?>", "\n")
                   .replaceAll("(?i)</p\\s*>", "\n")
                   .replaceAll("<[^>]+>", "")
                   .replaceAll("&nbsp;", " ")
                   .replaceAll("&lt;", "<").replaceAll("&gt;", ">")
                   .replaceAll("&amp;", "&").trim();
    }

    private float parseFloat(String s, float defaultVal) {
        try { return s != null ? Float.parseFloat(s) : defaultVal; }
        catch (NumberFormatException e) { return defaultVal; }
    }
}
