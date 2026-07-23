package com.cwgsyw.platform.module.task.plan;

import com.cwgsyw.platform.module.task.plan.scheduler.HolidayCalendarPort;
import com.cwgsyw.platform.module.task.plan.scheduler.TaskOccurrenceCalculator;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TaskOccurrenceCalculatorTest {
    private final HolidayCalendarPort holidays = new HolidayCalendarPort() {
        @Override
        public List<HolidayPeriod> findPeriods(String tenantId, LocalDate from, LocalDate to, String holidayType) {
            return List.of(new HolidayPeriod("国庆节", LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 7), "legal"));
        }

        @Override
        public LocalDate moveWorkdays(String tenantId, LocalDate anchor, int offset) {
            int remaining = Math.abs(offset);
            int direction = offset >= 0 ? 1 : -1;
            LocalDate cursor = anchor;
            while (remaining > 0) {
                cursor = cursor.plusDays(direction);
                if (cursor.getDayOfWeek().getValue() <= 5) remaining--;
            }
            return cursor;
        }
    };
    private final TaskOccurrenceCalculator calculator = new TaskOccurrenceCalculator(holidays);

    @Test
    void supportsCoreCalendarPeriods() {
        LocalDateTime start = LocalDateTime.of(2026, 1, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2026, 12, 31, 23, 59);

        assertThat(calculator.calculate("default", "once", Map.of("datetime", "2026-02-01T09:00"), start, end))
            .containsExactly(LocalDateTime.of(2026, 2, 1, 9, 0));
        assertThat(calculator.calculate("default", "daily", Map.of("time", "09:00", "weekdays", List.of("MON", "WED")),
            LocalDateTime.of(2026, 1, 5, 0, 0), LocalDateTime.of(2026, 1, 11, 23, 59))).hasSize(2);
        assertThat(calculator.calculate("default", "weekly", Map.of("time", "10:30", "weekday", "FRI"),
            LocalDateTime.of(2026, 1, 1, 0, 0), LocalDateTime.of(2026, 1, 31, 23, 59))).hasSize(5);
        assertThat(calculator.calculate("default", "monthly", Map.of("time", "08:00", "position", "last_day"), start, end)).hasSize(12);
        assertThat(calculator.calculate("default", "quarterly", Map.of("time", "08:00", "position", "last_day"), start, end)).hasSize(4);
        assertThat(calculator.calculate("default", "semiannual", Map.of("time", "08:00", "position", "first_day"), start, end)).hasSize(2);
        assertThat(calculator.calculate("default", "yearly", Map.of("time", "08:00", "month", 2, "day", 31), start, end))
            .containsExactly(LocalDateTime.of(2026, 2, 28, 8, 0));
    }

    @Test
    void supportsCronAndHolidayRelative() {
        assertThat(calculator.calculate("default", "cron", Map.of("expression", "0 0 9 * * MON-FRI"),
            LocalDateTime.of(2026, 1, 5, 0, 0), LocalDateTime.of(2026, 1, 11, 23, 59))).hasSize(5);
        assertThat(calculator.calculate("default", "holiday_relative",
            Map.of("relative", "before", "offsetWorkdays", 1, "time", "09:00", "holidayType", "legal"),
            LocalDateTime.of(2026, 9, 1, 0, 0), LocalDateTime.of(2026, 10, 31, 23, 59)))
            .containsExactly(LocalDateTime.of(2026, 9, 30, 9, 0));
    }
}
