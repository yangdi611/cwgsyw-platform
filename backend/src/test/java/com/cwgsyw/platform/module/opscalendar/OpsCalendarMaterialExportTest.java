package com.cwgsyw.platform.module.opscalendar;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTask;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTaskLink;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskLinkMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskMapper;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarMaterialService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.security.SecurityUser;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;

import java.io.ByteArrayInputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OpsCalendarMaterialExportTest {
    @Mock private OpsScheduleTaskMapper taskMapper;
    @Mock private OpsScheduleTaskLinkMapper linkMapper;
    @Mock private UserMapper userMapper;

    @Test
    void export_containsAuditablePeriodSummaryStatusAndDetailSections() throws Exception {
        OpsScheduleTask task = new OpsScheduleTask();
        task.setId(101L);
        task.setTitle("季度巡检");
        task.setTaskType("inspection");
        task.setStatus("completed");
        task.setCompletedAt(LocalDateTime.of(2026, 7, 15, 9, 30));
        when(taskMapper.selectList(any(Wrapper.class))).thenReturn(List.of(task));
        when(linkMapper.selectList(any(Wrapper.class))).thenReturn(List.of());
        when(userMapper.selectBatchIds(any())).thenReturn(List.of());

        OpsCalendarMaterialService service = new OpsCalendarMaterialService(taskMapper, linkMapper, userMapper);
        byte[] bytes = service.exportExcel("default", "quarter", LocalDate.of(2026, 5, 1),
                LocalDate.of(2026, 7, 31), null);

        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            assertThat(workbook.getSheet("概览").getRow(0).getCell(0).getStringCellValue()).isEqualTo("统计周期");
            assertThat(workbook.getSheet("概览").getRow(3).getCell(0).getStringCellValue()).isEqualTo("统计概览");
            assertThat(workbook.getSheet("概览").getRow(7).getCell(0).getStringCellValue()).isEqualTo("状态汇总");
            assertThat(workbook.getSheet("概览").getRow(9).getCell(0).getStringCellValue()).isEqualTo("completed");
            assertThat(workbook.getSheet("任务明细").getRow(0).getCell(0).getStringCellValue()).isEqualTo("任务明细");
            assertThat(workbook.getSheet("任务明细").getRow(2).getCell(1).getStringCellValue()).isEqualTo("季度巡检");
        }
    }

    @Test
    void export_response_hasAttachmentFilenameAndSpreadsheetMimeType() {
        OpsCalendarMaterialService service = org.mockito.Mockito.mock(OpsCalendarMaterialService.class);
        when(service.exportExcel(any(), any(), any(), any(), any())).thenReturn(new byte[] {1, 2, 3});
        OpsCalendarMaterialController controller = new OpsCalendarMaterialController(service);
        SecurityUser user = new SecurityUser(1L, "exporter", "", "default", null, "platform",
                Set.of("ops_calendar:export"));

        var response = controller.export("quarter", LocalDate.of(2026, 5, 1), LocalDate.of(2026, 7, 31), null, user);

        assertThat(response.getHeaders().getContentDisposition().getType()).isEqualTo("attachment");
        assertThat(response.getHeaders().getContentDisposition().getFilename()).isEqualTo("运维素材_2026-05-01_2026-07-31.xlsx");
        assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
    }

    @Test
    void collect_rejectsReversedDateRangeBeforeQuery() {
        OpsCalendarMaterialService service = new OpsCalendarMaterialService(taskMapper, linkMapper, userMapper);

        assertThatIllegalArgumentException().isThrownBy(() -> service.collect("default", "quarter",
                LocalDate.of(2026, 7, 31), LocalDate.of(2026, 5, 1), null));
    }
}
