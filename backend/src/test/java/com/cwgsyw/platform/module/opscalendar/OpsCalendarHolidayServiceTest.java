package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.opscalendar.dto.HolidayRequest;
import com.cwgsyw.platform.module.opscalendar.entity.OpsHolidayCalendar;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsHolidayCalendarMapper;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarHolidayService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class OpsCalendarHolidayServiceTest {
    @Mock OpsHolidayCalendarMapper holidayMapper;
    @Mock AuditLogMapper auditLogMapper;
    @InjectMocks OpsCalendarHolidayService service = new OpsCalendarHolidayService(holidayMapper, auditLogMapper, new ObjectMapper());

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

    private HolidayRequest request() {
        HolidayRequest request = new HolidayRequest();
        request.setName("validation holiday");
        request.setStartDate(LocalDate.of(2026, 10, 1));
        request.setEndDate(LocalDate.of(2026, 10, 3));
        request.setHolidayType("legal");
        return request;
    }
}
