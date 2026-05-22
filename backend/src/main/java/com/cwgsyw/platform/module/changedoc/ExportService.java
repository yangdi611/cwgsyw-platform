package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.module.changedoc.dto.ChangeDocVO;
import com.cwgsyw.platform.module.config.SysConfigService;
import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import lombok.RequiredArgsConstructor;
import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPageMar;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class ExportService {

    private final SysConfigService configService;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    public byte[] exportDocx(ChangeDocVO doc, String tenantId) {
        try (XWPFDocument xdoc = buildDocument(doc);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            xdoc.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("生成 Word 文档失败: " + e.getMessage(), e);
        }
    }

    public byte[] exportPdfDirect(ChangeDocVO doc, String tenantId) {
        String wmText    = configService.get(tenantId, "watermark.text");
        float  wmOpacity = parseFloat(configService.get(tenantId, "watermark.opacity"), 0.15f);
        float  wmAngle   = parseFloat(configService.get(tenantId, "watermark.angle"),   45f);
        float  wmSize    = parseFloat(configService.get(tenantId, "watermark.font_size"), 36f);
        if (wmText == null || wmText.isBlank()) wmText = "IT运维平台";

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            com.lowagie.text.Document pdf = new com.lowagie.text.Document(PageSize.A4, 72, 72, 90, 72);
            PdfWriter.getInstance(pdf, out);
            pdf.open();

            com.lowagie.text.Font titleFont   = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18);
            com.lowagie.text.Font headingFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12);
            com.lowagie.text.Font labelFont   = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11);
            com.lowagie.text.Font bodyFont    = FontFactory.getFont(FontFactory.HELVETICA, 11);

            pdf.add(new Paragraph("变更申请单", titleFont));
            pdf.add(Chunk.NEWLINE);
            addPdfField(pdf, "变更编号", doc.getChangeNo(), labelFont, bodyFont);
            addPdfField(pdf, "申请人",   doc.getApplicantName(), labelFont, bodyFont);
            addPdfField(pdf, "申请时间", doc.getApplyTime() != null ? doc.getApplyTime().format(FMT) : "", labelFont, bodyFont);
            addPdfField(pdf, "变更标题", doc.getTitle(), labelFont, bodyFont);
            addPdfField(pdf, "变更内容描述", doc.getChangeDesc(), labelFont, bodyFont);
            addPdfField(pdf, "影响范围",     doc.getImpactScope(), labelFont, bodyFont);
            addPdfField(pdf, "变更时间窗口", doc.getChangeWindow(), labelFont, bodyFont);
            addPdfField(pdf, "资源支持说明", doc.getResourceSupport(), labelFont, bodyFont);
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
            addPdfSection(pdf, "一、背景与目的",         doc.getBackground(), headingFont, bodyFont);
            addPdfSection(pdf, "二、详细操作步骤",       doc.getSteps(), headingFont, bodyFont);
            addPdfSection(pdf, "三、风险评估与应对措施", doc.getRiskAssessment(), headingFont, bodyFont);
            addPdfSection(pdf, "四、回滚计划",           doc.getRollbackPlan(), headingFont, bodyFont);
            addPdfSection(pdf, "五、验证方法",           doc.getVerifyMethod(), headingFont, bodyFont);
            addPdfSection(pdf, "六、相关人员联系方式",   doc.getContacts(), headingFont, bodyFont);

            pdf.close();
            return addWatermarkToPdf(out.toByteArray(), wmText, wmOpacity, wmAngle, wmSize);
        } catch (Exception e) {
            throw new RuntimeException("生成 PDF 失败: " + e.getMessage(), e);
        }
    }

    private XWPFDocument buildDocument(ChangeDocVO doc) {
        XWPFDocument xdoc = new XWPFDocument();
        setPageMargins(xdoc);

        addTitle(xdoc, "变更申请单");
        addField(xdoc, "变更编号", doc.getChangeNo());
        addField(xdoc, "申请人",   doc.getApplicantName());
        addField(xdoc, "申请时间", doc.getApplyTime() != null ? doc.getApplyTime().format(FMT) : "");
        addField(xdoc, "变更标题", doc.getTitle());
        addField(xdoc, "变更内容描述", doc.getChangeDesc());
        addField(xdoc, "影响范围",     doc.getImpactScope());
        addField(xdoc, "变更时间窗口", doc.getChangeWindow());
        addField(xdoc, "资源支持说明", doc.getResourceSupport());

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
        addSection(xdoc, "一、背景与目的",         doc.getBackground());
        addSection(xdoc, "二、详细操作步骤",       doc.getSteps());
        addSection(xdoc, "三、风险评估与应对措施", doc.getRiskAssessment());
        addSection(xdoc, "四、回滚计划",           doc.getRollbackPlan());
        addSection(xdoc, "五、验证方法",           doc.getVerifyMethod());
        addSection(xdoc, "六、相关人员联系方式",   doc.getContacts());

        return xdoc;
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
        valueRun.setText(value != null ? stripHtml(value) : "");
        valueRun.setFontFamily("宋体");
        valueRun.setFontSize(11);
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
        cr.setText(content != null ? stripHtml(content) : "（暂无内容）");
        cr.setFontFamily("宋体");
        cr.setFontSize(11);
    }

    private void addPageBreak(XWPFDocument xdoc) {
        XWPFParagraph p = xdoc.createParagraph();
        p.createRun().addBreak(BreakType.PAGE);
    }

    private void addPdfField(com.lowagie.text.Document pdf, String label, String value,
                              com.lowagie.text.Font labelFont, com.lowagie.text.Font bodyFont) throws DocumentException {
        Paragraph p = new Paragraph();
        p.add(new Chunk(label + "：", labelFont));
        p.add(new Chunk(value != null ? stripHtml(value) : "", bodyFont));
        p.setSpacingAfter(6);
        pdf.add(p);
    }

    private void addPdfSection(com.lowagie.text.Document pdf, String heading, String content,
                                com.lowagie.text.Font headingFont, com.lowagie.text.Font bodyFont) throws DocumentException {
        Paragraph h = new Paragraph(heading, headingFont);
        h.setSpacingBefore(10);
        h.setSpacingAfter(4);
        pdf.add(h);
        Paragraph c = new Paragraph(content != null ? stripHtml(content) : "（暂无内容）", bodyFont);
        c.setSpacingAfter(8);
        pdf.add(c);
    }

    private byte[] addWatermarkToPdf(byte[] pdfBytes, String text, float opacity, float angle, float fontSize) {
        try {
            PdfReader reader = new PdfReader(new ByteArrayInputStream(pdfBytes));
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            PdfStamper stamper = new PdfStamper(reader, out);
            BaseFont bf = BaseFont.createFont(BaseFont.HELVETICA, BaseFont.WINANSI, BaseFont.NOT_EMBEDDED);
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

    private String stripHtml(String html) {
        if (html == null) return "";
        return html.replaceAll("<[^>]+>", "").replaceAll("&nbsp;", " ")
                   .replaceAll("&lt;", "<").replaceAll("&gt;", ">")
                   .replaceAll("&amp;", "&").trim();
    }

    private float parseFloat(String s, float defaultVal) {
        try { return s != null ? Float.parseFloat(s) : defaultVal; }
        catch (NumberFormatException e) { return defaultVal; }
    }
}
