package com.cwgsyw.platform.module.task.plan.scheduler;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class JdbcHolidayCalendarAdapter implements HolidayCalendarPort {
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public List<HolidayPeriod> findPeriods(String tenantId, LocalDate from, LocalDate to, String holidayType) {
        String typeClause = holidayType == null ? "" : " AND holiday_type = ?";
        Object[] args = holidayType == null
            ? new Object[]{tenantId, to, from}
            : new Object[]{tenantId, to, from, holidayType};
        return jdbcTemplate.query("""
            SELECT name, start_date, end_date, holiday_type
            FROM ops_holiday_calendar
            WHERE tenant_id = ? AND enabled = TRUE AND is_deleted = FALSE
              AND start_date <= ? AND end_date >= ?
            """ + typeClause + " ORDER BY start_date, id", (resultSet, rowNum) -> new HolidayPeriod(
                resultSet.getString("name"),
                resultSet.getObject("start_date", LocalDate.class),
                resultSet.getObject("end_date", LocalDate.class),
                resultSet.getString("holiday_type")), args);
    }

    @Override
    public LocalDate moveWorkdays(String tenantId, LocalDate anchor, int offset) {
        if (offset == 0) return anchor;
        LocalDate rangeStart = anchor.minusDays(Math.abs(offset) * 4L + 60);
        LocalDate rangeEnd = anchor.plusDays(Math.abs(offset) * 4L + 60);
        Set<LocalDate> nonWorkdays = new HashSet<>();
        Set<LocalDate> overrides = new HashSet<>();
        jdbcTemplate.query("""
            SELECT start_date, end_date, workday_overrides
            FROM ops_holiday_calendar
            WHERE tenant_id = ? AND enabled = TRUE AND is_deleted = FALSE
              AND start_date <= ? AND end_date >= ?
            """, resultSet -> {
                LocalDate cursor = resultSet.getObject("start_date", LocalDate.class);
                LocalDate end = resultSet.getObject("end_date", LocalDate.class);
                while (!cursor.isAfter(end)) {
                    nonWorkdays.add(cursor);
                    cursor = cursor.plusDays(1);
                }
                try {
                    List<String> dates = objectMapper.readValue(resultSet.getString("workday_overrides"), new TypeReference<>() {});
                    dates.stream().map(LocalDate::parse).forEach(overrides::add);
                } catch (Exception ignored) {
                }
            }, tenantId, rangeEnd, rangeStart);

        int direction = offset > 0 ? 1 : -1;
        int remaining = Math.abs(offset);
        LocalDate cursor = anchor;
        while (remaining > 0) {
            cursor = cursor.plusDays(direction);
            boolean weekend = cursor.getDayOfWeek() == DayOfWeek.SATURDAY || cursor.getDayOfWeek() == DayOfWeek.SUNDAY;
            if (overrides.contains(cursor) || (!weekend && !nonWorkdays.contains(cursor))) remaining--;
        }
        return cursor;
    }
}
