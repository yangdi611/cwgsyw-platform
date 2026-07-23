package com.cwgsyw.platform.module.task.plan.scheduler;

import com.cwgsyw.platform.common.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class TaskOccurrenceCalculator {
    public static final int MAX_OCCURRENCES = 500;
    private final HolidayCalendarPort holidayCalendar;

    public List<LocalDateTime> calculate(String tenantId, String scheduleType, Map<String, Object> config,
                                         LocalDateTime windowStart, LocalDateTime windowEnd) {
        if (windowStart == null || windowEnd == null || windowEnd.isBefore(windowStart)) {
            throw BusinessException.badRequest("INVALID_OCCURRENCE_WINDOW", "周期预览时间范围无效");
        }
        Map<String, Object> safeConfig = config == null ? Map.of() : config;
        List<LocalDateTime> result = switch (scheduleType == null ? "" : scheduleType) {
            case "once" -> once(safeConfig, windowStart, windowEnd);
            case "daily" -> daily(tenantId, safeConfig, windowStart, windowEnd);
            case "weekly" -> weekly(tenantId, safeConfig, windowStart, windowEnd);
            case "monthly" -> monthly(tenantId, safeConfig, windowStart, windowEnd);
            case "quarterly" -> periodAnchors(tenantId, safeConfig, windowStart, windowEnd, 3);
            case "semiannual" -> periodAnchors(tenantId, safeConfig, windowStart, windowEnd, 6);
            case "yearly" -> yearly(tenantId, safeConfig, windowStart, windowEnd);
            case "cron" -> cron(safeConfig, windowStart, windowEnd);
            case "holiday_relative" -> holidayRelative(tenantId, safeConfig, windowStart, windowEnd);
            default -> throw BusinessException.badRequest("UNSUPPORTED_SCHEDULE_TYPE", "不支持的周期类型: " + scheduleType);
        };
        return result.stream().filter(value -> inWindow(value, windowStart, windowEnd)).distinct()
            .sorted(Comparator.naturalOrder()).limit(MAX_OCCURRENCES).toList();
    }

    public LocalDateTime next(String tenantId, String scheduleType, Map<String, Object> config, LocalDateTime after) {
        LocalDateTime cursor = after.plusNanos(1);
        for (int year = 1; year <= 5; year++) {
            List<LocalDateTime> values = calculate(tenantId, scheduleType, config, cursor, after.plusYears(year));
            if (!values.isEmpty()) return values.getFirst();
        }
        return null;
    }

    private List<LocalDateTime> once(Map<String, Object> config, LocalDateTime start, LocalDateTime end) {
        String value = text(config, "datetime", null);
        if (value == null) throw invalid("一次性计划必须配置 datetime");
        LocalDateTime occurrence = LocalDateTime.parse(value);
        return inWindow(occurrence, start, end) ? List.of(occurrence) : List.of();
    }

    private List<LocalDateTime> daily(String tenantId, Map<String, Object> config,
                                      LocalDateTime start, LocalDateTime end) {
        LocalTime time = localTime(config);
        Set<DayOfWeek> weekdays = daySet(config.get("weekdays"));
        boolean workdaysOnly = bool(config, "workdaysOnly", false);
        List<LocalDateTime> values = new ArrayList<>();
        for (LocalDate date = start.toLocalDate(); !date.isAfter(end.toLocalDate()); date = date.plusDays(1)) {
            if (!weekdays.isEmpty() && !weekdays.contains(date.getDayOfWeek())) continue;
            if (workdaysOnly && !date.equals(holidayCalendar.moveWorkdays(tenantId, date.minusDays(1), 1))) continue;
            values.add(LocalDateTime.of(date, time));
        }
        return values;
    }

    private List<LocalDateTime> weekly(String tenantId, Map<String, Object> config,
                                       LocalDateTime start, LocalDateTime end) {
        Set<DayOfWeek> weekdays = daySet(config.get("weekdays"));
        if (weekdays.isEmpty()) weekdays = Set.of(parseDay(text(config, "weekday", "MON")));
        Map<String, Object> dailyConfig = Map.of("time", text(config, "time", "09:00"), "weekdays", weekdays.stream().map(DayOfWeek::name).toList());
        return daily(tenantId, dailyConfig, start, end);
    }

    private List<LocalDateTime> monthly(String tenantId, Map<String, Object> config,
                                        LocalDateTime start, LocalDateTime end) {
        LocalTime time = localTime(config);
        List<LocalDateTime> values = new ArrayList<>();
        YearMonth cursor = YearMonth.from(start);
        YearMonth last = YearMonth.from(end);
        while (!cursor.isAfter(last) && values.size() < MAX_OCCURRENCES) {
            LocalDate anchor = monthAnchor(cursor, config);
            values.add(LocalDateTime.of(applyOffset(tenantId, anchor, config), time));
            cursor = cursor.plusMonths(intValue(config, "intervalMonths", 1));
        }
        return values;
    }

    private List<LocalDateTime> periodAnchors(String tenantId, Map<String, Object> config,
                                              LocalDateTime start, LocalDateTime end, int months) {
        LocalTime time = localTime(config);
        List<LocalDateTime> values = new ArrayList<>();
        int firstMonth = ((start.getMonthValue() - 1) / months) * months + 1;
        YearMonth cursor = YearMonth.of(start.getYear(), firstMonth);
        while (cursor.atDay(1).atStartOfDay().isBefore(end.plusMonths(months)) && values.size() < MAX_OCCURRENCES) {
            boolean first = "first_day".equals(text(config, "position", text(config, "quarterPosition", "last_day")));
            LocalDate anchor = first ? cursor.atDay(1) : cursor.plusMonths(months - 1L).atEndOfMonth();
            values.add(LocalDateTime.of(applyOffset(tenantId, anchor, config), time));
            cursor = cursor.plusMonths(months);
        }
        return values;
    }

    private List<LocalDateTime> yearly(String tenantId, Map<String, Object> config,
                                       LocalDateTime start, LocalDateTime end) {
        List<LocalDateTime> values = new ArrayList<>();
        int month = bounded(intValue(config, "month", 1), 1, 12);
        int day = Math.max(1, intValue(config, "day", 1));
        for (int year = start.getYear(); year <= end.getYear(); year++) {
            YearMonth yearMonth = YearMonth.of(year, month);
            LocalDate anchor = yearMonth.atDay(Math.min(day, yearMonth.lengthOfMonth()));
            values.add(LocalDateTime.of(applyOffset(tenantId, anchor, config), localTime(config)));
        }
        return values;
    }

    private List<LocalDateTime> cron(Map<String, Object> config, LocalDateTime start, LocalDateTime end) {
        String expression = text(config, "expression", null);
        if (expression == null || expression.isBlank()) throw invalid("Cron 计划必须配置 expression");
        CronExpression cron;
        try {
            cron = CronExpression.parse(expression);
        } catch (IllegalArgumentException exception) {
            throw invalid("Cron 表达式无效");
        }
        List<LocalDateTime> values = new ArrayList<>();
        LocalDateTime cursor = start.minusNanos(1);
        while (values.size() < MAX_OCCURRENCES) {
            LocalDateTime next = cron.next(cursor);
            if (next == null || next.isAfter(end)) break;
            values.add(next);
            cursor = next;
        }
        return values;
    }

    private List<LocalDateTime> holidayRelative(String tenantId, Map<String, Object> config,
                                                LocalDateTime start, LocalDateTime end) {
        String relative = text(config, "relative", "before");
        int distance = Math.max(1, Math.abs(intValue(config, "offsetWorkdays", 1)));
        int offset = "after".equals(relative) ? distance : -distance;
        String holidayType = text(config, "holidayType", null);
        return holidayCalendar.findPeriods(tenantId, start.toLocalDate().minusDays(60), end.toLocalDate().plusDays(60), holidayType)
            .stream().map(period -> "after".equals(relative) ? period.endDate() : period.startDate())
            .map(anchor -> holidayCalendar.moveWorkdays(tenantId, anchor, offset))
            .map(date -> LocalDateTime.of(date, localTime(config))).toList();
    }

    private LocalDate monthAnchor(YearMonth month, Map<String, Object> config) {
        String position = text(config, "position", "day_of_month");
        if ("first_day".equals(position)) return month.atDay(1);
        if ("last_day".equals(position)) return month.atEndOfMonth();
        int day = Math.max(1, intValue(config, "day", intValue(config, "dayOfMonth", 1)));
        return month.atDay(Math.min(day, month.lengthOfMonth()));
    }

    private LocalDate applyOffset(String tenantId, LocalDate anchor, Map<String, Object> config) {
        if (config.containsKey("offsetWorkdays")) {
            return holidayCalendar.moveWorkdays(tenantId, anchor, intValue(config, "offsetWorkdays", 0));
        }
        return anchor.plusDays(intValue(config, "offsetDays", 0));
    }

    private LocalTime localTime(Map<String, Object> config) {
        try {
            return LocalTime.parse(text(config, "time", "09:00"));
        } catch (Exception exception) {
            throw invalid("time 必须使用 HH:mm[:ss] 格式");
        }
    }

    private Set<DayOfWeek> daySet(Object value) {
        if (!(value instanceof Iterable<?> iterable)) return Set.of();
        Set<DayOfWeek> result = new LinkedHashSet<>();
        for (Object item : iterable) result.add(parseDay(String.valueOf(item)));
        return result;
    }

    private DayOfWeek parseDay(String value) {
        try {
            String normalized = value.trim().toUpperCase();
            if (normalized.length() == 3) {
                return switch (normalized) {
                    case "MON" -> DayOfWeek.MONDAY;
                    case "TUE" -> DayOfWeek.TUESDAY;
                    case "WED" -> DayOfWeek.WEDNESDAY;
                    case "THU" -> DayOfWeek.THURSDAY;
                    case "FRI" -> DayOfWeek.FRIDAY;
                    case "SAT" -> DayOfWeek.SATURDAY;
                    case "SUN" -> DayOfWeek.SUNDAY;
                    default -> throw new IllegalArgumentException();
                };
            }
            return DayOfWeek.valueOf(normalized);
        } catch (Exception exception) {
            throw invalid("weekdays 包含无效星期值: " + value);
        }
    }

    private boolean inWindow(LocalDateTime value, LocalDateTime start, LocalDateTime end) {
        return !value.isBefore(start) && !value.isAfter(end);
    }

    private String text(Map<String, Object> values, String key, String fallback) {
        Object value = values.get(key);
        return value == null ? fallback : String.valueOf(value);
    }

    private int intValue(Map<String, Object> values, String key, int fallback) {
        Object value = values.get(key);
        if (value == null) return fallback;
        if (value instanceof Number number) return number.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException exception) {
            throw invalid(key + " 必须是整数");
        }
    }

    private boolean bool(Map<String, Object> values, String key, boolean fallback) {
        Object value = values.get(key);
        return value == null ? fallback : Boolean.parseBoolean(String.valueOf(value));
    }

    private int bounded(int value, int minimum, int maximum) {
        return Math.min(maximum, Math.max(minimum, value));
    }

    private BusinessException invalid(String message) {
        return BusinessException.badRequest("INVALID_SCHEDULE_CONFIG", message);
    }
}
