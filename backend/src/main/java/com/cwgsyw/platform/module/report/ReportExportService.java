package com.cwgsyw.platform.module.report;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.daily.DailyReportMapper;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReportExportService {

    private final DailyReportMapper reportMapper;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;

    public byte[] exportExcel(String tenantId, String startDate, String endDate, Long groupId) {
        LocalDate start = LocalDate.parse(startDate);
        LocalDate end   = LocalDate.parse(endDate);

        LambdaQueryWrapper<DailyReport> q = new LambdaQueryWrapper<DailyReport>()
                .eq(DailyReport::getTenantId, tenantId)
                .eq(DailyReport::getStatus, "APPROVED")
                .ge(DailyReport::getReportDate, start)
                .le(DailyReport::getReportDate, end)
                .orderByAsc(DailyReport::getReportDate)
                .orderByAsc(DailyReport::getGroupId);
        if (groupId != null) q.eq(DailyReport::getGroupId, groupId);

        List<DailyReport> reports = reportMapper.selectList(q);

        Map<Long, String> userNames  = batchUserNames(reports);
        Map<Long, String> groupNames = batchGroupNames(reports);

        try (XSSFWorkbook wb = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = wb.createSheet("工作日报");
            sheet.setColumnWidth(0, 14 * 256);
            sheet.setColumnWidth(1, 12 * 256);
            sheet.setColumnWidth(2, 12 * 256);
            sheet.setColumnWidth(3, 40 * 256);
            sheet.setColumnWidth(4, 30 * 256);
            sheet.setColumnWidth(5, 30 * 256);
            sheet.setColumnWidth(6,  8 * 256);

            CellStyle titleStyle  = titleStyle(wb);
            CellStyle headerStyle = headerStyle(wb);
            CellStyle bodyStyle   = bodyStyle(wb);
            CellStyle wrapStyle   = wrapStyle(wb);

            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(24);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("工作日报汇总（" + startDate + " 至 " + endDate + "）");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 6));

            Row header = sheet.createRow(1);
            String[] headers = {"日期", "姓名", "组别", "今日完成事项", "遇到问题", "明日计划", "工时(h)"};
            for (int i = 0; i < headers.length; i++) {
                Cell c = header.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
            }

            DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");
            int rowIdx = 2;
            for (DailyReport r : reports) {
                Row row = sheet.createRow(rowIdx++);
                row.setHeightInPoints(60);
                cell(row, 0, r.getReportDate().format(dateFmt), bodyStyle);
                cell(row, 1, userNames.getOrDefault(r.getReporterId(), String.valueOf(r.getReporterId())), bodyStyle);
                cell(row, 2, groupNames.getOrDefault(r.getGroupId(), ""), bodyStyle);
                cell(row, 3, nvl(r.getCompletedItems()), wrapStyle);
                cell(row, 4, nvl(r.getIssues()), wrapStyle);
                cell(row, 5, nvl(r.getTomorrowPlan()), wrapStyle);
                if (r.getWorkHours() != null) {
                    Cell wc = row.createCell(6);
                    wc.setCellValue(r.getWorkHours().doubleValue());
                    wc.setCellStyle(bodyStyle);
                }
            }

            wb.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("生成 Excel 失败: " + e.getMessage(), e);
        }
    }

    private CellStyle titleStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        f.setFontHeightInPoints((short) 14);
        s.setFont(f);
        s.setAlignment(HorizontalAlignment.CENTER);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        return s;
    }

    private CellStyle headerStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        s.setFont(f);
        s.setAlignment(HorizontalAlignment.CENTER);
        s.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        setBorder(s);
        return s;
    }

    private CellStyle bodyStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        s.setAlignment(HorizontalAlignment.CENTER);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        setBorder(s);
        return s;
    }

    private CellStyle wrapStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        s.setWrapText(true);
        s.setVerticalAlignment(VerticalAlignment.TOP);
        setBorder(s);
        return s;
    }

    private void setBorder(CellStyle s) {
        s.setBorderTop(BorderStyle.THIN);
        s.setBorderBottom(BorderStyle.THIN);
        s.setBorderLeft(BorderStyle.THIN);
        s.setBorderRight(BorderStyle.THIN);
    }

    private void cell(Row row, int col, String value, CellStyle style) {
        Cell c = row.createCell(col);
        c.setCellValue(value);
        c.setCellStyle(style);
    }

    private String nvl(String s) { return s != null ? s : ""; }

    private Map<Long, String> batchUserNames(List<DailyReport> reports) {
        var ids = reports.stream().map(DailyReport::getReporterId).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return userMapper.selectBatchIds(ids).stream().collect(Collectors.toMap(
                com.cwgsyw.platform.module.user.entity.User::getId,
                u -> u.getRealName() != null ? u.getRealName() : u.getUsername()));
    }

    private Map<Long, String> batchGroupNames(List<DailyReport> reports) {
        var ids = reports.stream().filter(r -> r.getGroupId() != null)
                .map(DailyReport::getGroupId).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return groupMapper.selectBatchIds(ids).stream().collect(Collectors.toMap(
                com.cwgsyw.platform.module.org.entity.Group::getId,
                com.cwgsyw.platform.module.org.entity.Group::getName));
    }
}
