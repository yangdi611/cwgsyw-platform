package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.opscalendar.dto.HolidayRequest;
import com.cwgsyw.platform.module.opscalendar.entity.OpsHolidayCalendar;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsHolidayCalendarMapper;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarHolidayService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OpsCalendarHolidayServiceTest {
    @Mock OpsHolidayCalendarMapper holidayMapper;
    @Mock AuditLogMapper auditLogMapper;
    OpsCalendarHolidayService service;

    @BeforeEach
    void setUp() {
        service = new OpsCalendarHolidayService(holidayMapper, auditLogMapper, new ObjectMapper());
    }

    @Test
    void createRejectsMissingFieldsInvalidTypeReverseRangeAndMalformedOverridesBeforeInsert() {
        HolidayRequest missing = new HolidayRequest();
        assertThatThrownBy(() -> service.create(missing, "default", 1L))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("节假日名称必填");

        HolidayRequest invalidType = request();
        invalidType.setHolidayType("custom");
        assertThatThrownBy(() -> service.create(invalidType, "default", 1L))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("不支持的节假日类型");

        HolidayRequest reverseRange = request();
        reverseRange.setEndDate(reverseRange.getStartDate().minusDays(1));
        assertThatThrownBy(() -> service.create(reverseRange, "default", 1L))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("结束日期不能早于开始日期");

        HolidayRequest malformedOverrides = request();
        malformedOverrides.setWorkdayOverrides("not-json");
        assertThatThrownBy(() -> service.create(malformedOverrides, "default", 1L))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("调休日期必须是 ISO 日期数组");

        verify(holidayMapper, never()).insert(any(OpsHolidayCalendar.class));
    }

    @Test
    void importChinaHolidaysRecordsUpdaterForEveryInsertedRow() {
        when(holidayMapper.selectCount(any())).thenReturn(0L);

        int created = service.importChinaHolidays(2026, "tenant-a", 42L);

        var rows = org.mockito.ArgumentCaptor.forClass(OpsHolidayCalendar.class);
        verify(holidayMapper, org.mockito.Mockito.times(created)).insert(rows.capture());
        assertThat(created).isPositive();
        assertThat(rows.getAllValues()).allSatisfy(row -> {
            assertThat(row.getTenantId()).isEqualTo("tenant-a");
            assertThat(row.getUpdatedBy()).isEqualTo(42L);
        });
    }

    @Test
    void deleteRejectsCrossTenantHolidayWithoutWrites() {
        OpsHolidayCalendar holiday = new OpsHolidayCalendar();
        holiday.setId(7L);
        holiday.setTenantId("other-tenant");
        when(holidayMapper.selectById(7L)).thenReturn(holiday);

        assertThatThrownBy(() -> service.delete(7L, "tenant-a", 42L))
            .isInstanceOf(IllegalArgumentException.class).hasMessage("节假日不存在");

        verify(holidayMapper, never()).updateById(any(OpsHolidayCalendar.class));
        verify(holidayMapper, never()).deleteById(anyLong());
        verify(auditLogMapper, never()).insert(
            org.mockito.ArgumentMatchers.<com.cwgsyw.platform.common.entity.AuditLog>any());
    }

    @Test
    void deleteRecordsUpdaterAndAudit() {
        OpsHolidayCalendar holiday = new OpsHolidayCalendar();
        holiday.setId(8L);
        holiday.setTenantId("tenant-a");
        holiday.setName("公司假期");
        when(holidayMapper.selectById(8L)).thenReturn(holiday);

        service.delete(8L, "tenant-a", 42L);

        var updated = org.mockito.ArgumentCaptor.forClass(OpsHolidayCalendar.class);
        verify(holidayMapper).updateById(updated.capture());
        assertThat(updated.getValue().getUpdatedBy()).isEqualTo(42L);
        verify(holidayMapper).deleteById(8L);
        var audit = org.mockito.ArgumentCaptor.forClass(com.cwgsyw.platform.common.entity.AuditLog.class);
        verify(auditLogMapper).insert(audit.capture());
        assertThat(audit.getValue().getTenantId()).isEqualTo("tenant-a");
        assertThat(audit.getValue().getAction()).isEqualTo("delete");
        assertThat(audit.getValue().getTargetType()).isEqualTo("ops_holiday_calendar");
        assertThat(audit.getValue().getTargetId()).isEqualTo(8L);
        assertThat(audit.getValue().getOperatorId()).isEqualTo(42L);
    }

    private HolidayRequest request() {
        HolidayRequest request = new HolidayRequest();
        request.setName("validation holiday");
        request.setStartDate(LocalDate.of(2026, 10, 1));
        request.setEndDate(LocalDate.of(2026, 10, 3));
        request.setHolidayType("legal");
        return request;
    }
}
