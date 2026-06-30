package com.cwgsyw.platform.module.opscalendar.service;

import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleRule;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;

import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 计算周期规则在 [windowStart, windowEnd] 内的所有 occurrence（计划开始时间）。
 *
 * 阶段约定（见 spec 6.3）：
 *  - cron / daily / weekly / monthly / quarterly / semiannual / yearly / once 属 Phase 2，已实现。
 *  - quarterly/semiannual 的「最后 N 天」按自然日计算，不做工作日跳过。
 *  - holiday_relative 与「第 N 个工作日」推算属 Phase 4，此处返回空列表（不生成）。
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OccurrenceCalculator {

    private final ObjectMapper objectMapper;

    public List<LocalDateTime> calculate(OpsScheduleRule rule, LocalDateTime windowStart, LocalDateTime windowEnd) {
        Map<String, Object> cfg = parseConfig(rule.getTriggerConfig());
        String type = rule.getTriggerType();
        try {
            return switch (type) {
                case "once" -> once(cfg, windowStart, windowEnd);
                case "daily" -> daily(cfg, windowStart, windowEnd);
                case "weekly" -> weekly(cfg, windowStart, windowEnd);
                case "monthly" -> monthly(cfg, windowStart, windowEnd);
                case "quarterly" -> quarterly(cfg, windowStart, windowEnd);
                case "semiannual" -> semiannual(cfg, windowStart, windowEnd);
                case "yearly" -> yearly(cfg, windowStart, windowEnd);
                case "cron" -> cron(cfg, windowStart, windowEnd);
                case "holiday_relative" -> List.of(); // Phase 4
                default -> List.of();
            };
        } catch (Exception e) {
            log.warn("Occurrence calc failed for rule {} ({}): {}", rule.getId(), type, e.getMessage());
            return List.of();
        }
    }

    // ---- once ----
    private List<LocalDateTime> once(Map<String, Object> cfg, LocalDateTime ws, LocalDateTime we) {
        String dt = str(cfg, "datetime", null);
        if (dt == null) return List.of();
        LocalDateTime t = LocalDateTime.parse(dt);
        return inWindow(t, ws, we) ? List.of(t) : List.of();
    }

    // ---- daily: every day (or only weekdays listed) at time ----
    private List<LocalDateTime> daily(Map<String, Object> cfg, LocalDateTime ws, LocalDateTime we) {
        LocalTime time = time(cfg, "09:00");
        List<String> weekdays = strList(cfg, "weekdays");
        List<LocalDateTime> out = new ArrayList<>();
        for (LocalDate d = ws.toLocalDate(); !d.isAfter(we.toLocalDate()); d = d.plusDays(1)) {
            if (!weekdays.isEmpty() && !weekdays.contains(dowToken(d))) continue;
            LocalDateTime t = LocalDateTime.of(d, time);
            if (inWindow(t, ws, we)) out.add(t);
        }
        return out;
    }

    // ---- weekly: a given weekday at time ----
    private List<LocalDateTime> weekly(Map<String, Object> cfg, LocalDateTime ws, LocalDateTime we) {
        DayOfWeek target = parseDow(str(cfg, "weekday", "MON"));
        LocalTime time = time(cfg, "09:00");
        List<LocalDateTime> out = new ArrayList<>();
        for (LocalDate d = ws.toLocalDate(); !d.isAfter(we.toLocalDate()); d = d.plusDays(1)) {
            if (d.getDayOfWeek() == target) {
                LocalDateTime t = LocalDateTime.of(d, time);
                if (inWindow(t, ws, we)) out.add(t);
            }
        }
        return out;
    }

    // ---- monthly: a day of month, or last day, at time ----
    private List<LocalDateTime> monthly(Map<String, Object> cfg, LocalDateTime ws, LocalDateTime we) {
        LocalTime time = time(cfg, "09:00");
        String position = str(cfg, "monthPosition", null); // "last_day" | "first_day" | null
        Integer dayOfMonth = intVal(cfg, "dayOfMonth", null);
        List<LocalDateTime> out = new ArrayList<>();
        YearMonth ym = YearMonth.from(ws.toLocalDate());
        YearMonth end = YearMonth.from(we.toLocalDate());
        while (!ym.isAfter(end)) {
            LocalDate d = resolveMonthDate(ym, position, dayOfMonth);
            LocalDateTime t = LocalDateTime.of(d, time);
            if (inWindow(t, ws, we)) out.add(t);
            ym = ym.plusMonths(1);
        }
        return out;
    }

    private LocalDate resolveMonthDate(YearMonth ym, String position, Integer dayOfMonth) {
        if ("last_day".equals(position)) return ym.atEndOfMonth();
        if ("first_day".equals(position)) return ym.atDay(1);
        int dom = dayOfMonth != null ? Math.min(dayOfMonth, ym.lengthOfMonth()) : 1;
        return ym.atDay(dom);
    }

    // ---- quarterly: first_day / last_day of quarter + natural-day offset ----
    private List<LocalDateTime> quarterly(Map<String, Object> cfg, LocalDateTime ws, LocalDateTime we) {
        LocalTime time = time(cfg, "09:00");
        String position = str(cfg, "quarterPosition", "last_day"); // first_day | last_day
        int offsetDays = intVal(cfg, "offsetDays", 0);
        List<LocalDateTime> out = new ArrayList<>();
        int year = ws.getYear();
        for (int y = year; y <= we.getYear(); y++) {
            for (int q = 1; q <= 4; q++) {
                LocalDate anchor = "first_day".equals(position)
                        ? quarterFirstDay(y, q) : quarterLastDay(y, q);
                LocalDate d = anchor.plusDays(offsetDays);
                LocalDateTime t = LocalDateTime.of(d, time);
                if (inWindow(t, ws, we)) out.add(t);
            }
        }
        return out;
    }

    // ---- semiannual: first/last day of half-year + natural-day offset ----
    private List<LocalDateTime> semiannual(Map<String, Object> cfg, LocalDateTime ws, LocalDateTime we) {
        LocalTime time = time(cfg, "09:00");
        String position = str(cfg, "position", "last_day");
        int offsetDays = intVal(cfg, "offsetDays", 0);
        List<LocalDateTime> out = new ArrayList<>();
        for (int y = ws.getYear(); y <= we.getYear(); y++) {
            LocalDate[] anchors = "first_day".equals(position)
                    ? new LocalDate[]{ LocalDate.of(y,1,1), LocalDate.of(y,7,1) }
                    : new LocalDate[]{ LocalDate.of(y,6,30), LocalDate.of(y,12,31) };
            for (LocalDate anchor : anchors) {
                LocalDate d = anchor.plusDays(offsetDays);
                LocalDateTime t = LocalDateTime.of(d, time);
                if (inWindow(t, ws, we)) out.add(t);
            }
        }
        return out;
    }

    // ---- yearly: month + day at time ----
    private List<LocalDateTime> yearly(Map<String, Object> cfg, LocalDateTime ws, LocalDateTime we) {
        LocalTime time = time(cfg, "09:00");
        int month = intVal(cfg, "month", 1);
        int day = intVal(cfg, "day", 1);
        List<LocalDateTime> out = new ArrayList<>();
        for (int y = ws.getYear(); y <= we.getYear(); y++) {
            LocalDate d = LocalDate.of(y, month, Math.min(day, YearMonth.of(y, month).lengthOfMonth()));
            LocalDateTime t = LocalDateTime.of(d, time);
            if (inWindow(t, ws, we)) out.add(t);
        }
        return out;
    }

    // ---- cron: Spring 6-field cron ----
    private List<LocalDateTime> cron(Map<String, Object> cfg, LocalDateTime ws, LocalDateTime we) {
        String expr = str(cfg, "expression", null);
        if (expr == null || expr.isBlank()) return List.of();
        CronExpression cron = CronExpression.parse(expr);
        List<LocalDateTime> out = new ArrayList<>();
        LocalDateTime cursor = ws.minusSeconds(1);
        for (int i = 0; i < 500; i++) {
            LocalDateTime next = cron.next(cursor);
            if (next == null || next.isAfter(we)) break;
            out.add(next);
            cursor = next;
        }
        return out;
    }

    // ---- quarter helpers ----
    public static LocalDate quarterFirstDay(int year, int quarter) {
        int month = (quarter - 1) * 3 + 1;
        return LocalDate.of(year, month, 1);
    }

    public static LocalDate quarterLastDay(int year, int quarter) {
        int month = quarter * 3;
        return LocalDate.of(year, month, 1).with(TemporalAdjusters.lastDayOfMonth());
    }

    // ---- shared helpers ----
    private boolean inWindow(LocalDateTime t, LocalDateTime ws, LocalDateTime we) {
        return !t.isBefore(ws) && !t.isAfter(we);
    }

    private LocalTime time(Map<String, Object> cfg, String def) {
        String s = str(cfg, "time", def);
        try { return LocalTime.parse(s); } catch (Exception e) { return LocalTime.parse(def); }
    }

    private String dowToken(LocalDate d) {
        return switch (d.getDayOfWeek()) {
            case MONDAY -> "MON"; case TUESDAY -> "TUE"; case WEDNESDAY -> "WED";
            case THURSDAY -> "THU"; case FRIDAY -> "FRI"; case SATURDAY -> "SAT"; case SUNDAY -> "SUN";
        };
    }

    private DayOfWeek parseDow(String s) {
        return switch (s == null ? "MON" : s.toUpperCase()) {
            case "MON" -> DayOfWeek.MONDAY; case "TUE" -> DayOfWeek.TUESDAY; case "WED" -> DayOfWeek.WEDNESDAY;
            case "THU" -> DayOfWeek.THURSDAY; case "FRI" -> DayOfWeek.FRIDAY;
            case "SAT" -> DayOfWeek.SATURDAY; case "SUN" -> DayOfWeek.SUNDAY;
            default -> DayOfWeek.MONDAY;
        };
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseConfig(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try { return objectMapper.readValue(json, Map.class); }
        catch (Exception e) { return Map.of(); }
    }

    private String str(Map<String, Object> m, String k, String def) {
        Object v = m.get(k);
        return v == null ? def : String.valueOf(v);
    }

    private Integer intVal(Map<String, Object> m, String k, Integer def) {
        Object v = m.get(k);
        if (v == null) return def;
        if (v instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(v)); } catch (Exception e) { return def; }
    }

    @SuppressWarnings("unchecked")
    private List<String> strList(Map<String, Object> m, String k) {
        Object v = m.get(k);
        if (v instanceof List<?> l) {
            List<String> out = new ArrayList<>();
            for (Object o : l) out.add(String.valueOf(o));
            return out;
        }
        return List.of();
    }
}
