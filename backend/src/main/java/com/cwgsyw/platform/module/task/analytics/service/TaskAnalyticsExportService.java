package com.cwgsyw.platform.module.task.analytics.service;

import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsQueryRequest;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsQueryResponse;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TaskAnalyticsExportService {
    private final TaskAnalyticsQueryService queryService;

    public ExportFile export(SecurityUser user, AnalyticsQueryRequest request, String format, String requestedName) {
        AnalyticsQueryResponse response = queryService.query(user, request);
        String effectiveFormat = "csv".equalsIgnoreCase(format) ? "csv" : "xlsx";
        String baseName = sanitizeName(requestedName == null || requestedName.isBlank() ? "任务统计" : requestedName);
        return "csv".equals(effectiveFormat)
            ? new ExportFile(baseName + ".csv", "text/csv; charset=UTF-8", csv(response))
            : new ExportFile(baseName + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", excel(response));
    }

    private byte[] csv(AnalyticsQueryResponse response) {
        StringBuilder output = new StringBuilder("\uFEFF");
        output.append("统计口径,").append(csvCell(String.valueOf(response.definition()))).append('\n');
        output.append("生成时间,").append(csvCell(response.generatedAt().toString())).append('\n').append('\n');
        output.append(response.columns().stream().map(this::csvCell).collect(java.util.stream.Collectors.joining(","))).append('\n');
        for (Map<String, Object> row : response.rows()) {
            output.append(response.columns().stream().map(column -> csvCell(display(row.get(column))))
                .collect(java.util.stream.Collectors.joining(","))).append('\n');
        }
        return output.toString().getBytes(StandardCharsets.UTF_8);
    }

    private byte[] excel(AnalyticsQueryResponse response) {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("统计结果");
            Row definition = sheet.createRow(0);
            definition.createCell(0).setCellValue("统计口径");
            definition.createCell(1).setCellValue(String.valueOf(response.definition()));
            Row generated = sheet.createRow(1);
            generated.createCell(0).setCellValue("生成时间");
            generated.createCell(1).setCellValue(response.generatedAt().toString());
            Row header = sheet.createRow(3);
            CellStyle headerStyle = headerStyle(workbook);
            for (int index = 0; index < response.columns().size(); index++) {
                Cell cell = header.createCell(index);
                cell.setCellValue(response.columns().get(index));
                cell.setCellStyle(headerStyle);
            }
            int rowNumber = 4;
            for (Map<String, Object> values : response.rows()) {
                Row row = sheet.createRow(rowNumber++);
                for (int index = 0; index < response.columns().size(); index++) {
                    row.createCell(index).setCellValue(display(values.get(response.columns().get(index))));
                }
            }
            for (int index = 0; index < response.columns().size(); index++) sheet.setColumnWidth(index, 22 * 256);
            workbook.write(output);
            return output.toByteArray();
        } catch (Exception exception) {
            throw new IllegalStateException("生成任务统计导出失败", exception);
        }
    }

    private CellStyle headerStyle(XSSFWorkbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private String csvCell(String value) {
        String safe = value == null ? "" : value;
        if (!safe.isEmpty() && "=+-@".indexOf(safe.charAt(0)) >= 0) safe = "'" + safe;
        return '"' + safe.replace("\"", "\"\"") + '"';
    }

    private String display(Object value) {
        if (value == null) return "";
        if (value instanceof LocalDateTime dateTime) return dateTime.toString();
        if (value instanceof List<?> list) return String.join(" | ", list.stream().map(String::valueOf).toList());
        return String.valueOf(value);
    }

    private String sanitizeName(String value) {
        String cleaned = value.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        return cleaned.isBlank() ? "任务统计" : cleaned;
    }

    public record ExportFile(String fileName, String contentType, byte[] bytes) {}
}
