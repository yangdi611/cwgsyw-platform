package com.cwgsyw.platform.module.task.analytics;

import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsQueryResponse;
import com.cwgsyw.platform.module.task.analytics.service.TaskAnalyticsExportService;
import com.cwgsyw.platform.module.task.analytics.service.TaskAnalyticsQueryService;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskAnalyticsExportServiceTest {
    @Mock TaskAnalyticsQueryService queryService;

    private TaskAnalyticsExportService service;

    @BeforeEach
    void setUp() {
        service = new TaskAnalyticsExportService(queryService);
    }

    @Test
    void exportsChineseColumnLabelsWithoutChangingRowKeys() throws Exception {
        AnalyticsQueryResponse response = new AnalyticsQueryResponse(
            List.of("taskId", "completed_items"),
            Map.of("taskId", "任务ID", "completed_items", "今日完成事项"),
            List.of(Map.of("taskId", 21L, "completed_items", "完成统计修复")),
            2L, LocalDateTime.of(2026, 7, 24, 9, 36), "current_effective", Map.of());
        when(queryService.query(null, null)).thenReturn(response);

        TaskAnalyticsExportService.ExportFile csv = service.export(null, null, "csv", "任务统计");
        assertThat(new String(csv.bytes(), StandardCharsets.UTF_8))
            .contains("\"任务ID\",\"今日完成事项\"")
            .contains("\"21\",\"完成统计修复\"");

        TaskAnalyticsExportService.ExportFile excel = service.export(null, null, "xlsx", "任务统计");
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(excel.bytes()))) {
            assertThat(workbook.getSheet("统计结果").getRow(3).getCell(0).getStringCellValue()).isEqualTo("任务ID");
            assertThat(workbook.getSheet("统计结果").getRow(3).getCell(1).getStringCellValue()).isEqualTo("今日完成事项");
        }
    }
}
