package com.cwgsyw.platform.scheduler;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.config.SysConfigService;
import com.cwgsyw.platform.module.daily.DailyReportMapper;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class DailyReportReminderScheduler {
    private final SysConfigService configService;
    private final UserMapper userMapper;
    private final DailyReportMapper reportMapper;
    private final NotificationService notificationService;

    // Runs every minute; actual send is gated by config cron check
    @Scheduled(cron = "0 * * * * *")
    public void checkAndSendReminders() {
        String tenantId = "default";
        if (!configService.getBoolean(tenantId, "notify.reminder.enabled")) return;

        String configCron = configService.get(tenantId, "notify.reminder.cron");
        if (!matchesCurrentMinute(configCron)) return;

        LocalDate today = LocalDate.now();
        List<User> allUsers = userMapper.selectList(
            new LambdaQueryWrapper<User>().eq(User::getIsDeleted, false));

        Set<Long> haveFiled = reportMapper.selectList(
            new LambdaQueryWrapper<DailyReport>()
                .eq(DailyReport::getReportDate, today)
                .eq(DailyReport::getIsDeleted, false))
            .stream().map(DailyReport::getReporterId).collect(Collectors.toSet());

        String template = configService.get(tenantId, "notify.reminder.template");

        allUsers.stream()
            .filter(u -> !haveFiled.contains(u.getId()))
            .forEach(u -> {
                log.info("Sending daily report reminder to user {}", u.getId());
                notificationService.notify(tenantId, u.getId(),
                    "工作日报提醒", template,
                    "daily_report_reminder", null, null);
            });
    }

    // Checks if current time matches the Spring 6-field cron: sec min hour dom month dow
    // Only handles the default pattern: "0 0 17 * * MON-FRI"
    private boolean matchesCurrentMinute(String cron) {
        if (cron == null || cron.isBlank()) return false;
        try {
            String[] parts = cron.trim().split("\\s+");
            if (parts.length < 6) return false;
            LocalDateTime now = LocalDateTime.now();
            boolean minMatch  = parts[1].equals("*") || parts[1].equals(String.valueOf(now.getMinute()));
            boolean hourMatch = parts[2].equals("*") || parts[2].equals(String.valueOf(now.getHour()));
            String dow = parts[5];
            // Spring cron DOW: MON=1..SUN=7 (ISO), but also supports MON-FRI string
            // DayOfWeek.getValue(): MON=1..SUN=7
            int dayOfWeek = now.getDayOfWeek().getValue();
            boolean dowMatch = dow.equals("*") || matchDow(dow, dayOfWeek);
            return minMatch && hourMatch && dowMatch;
        } catch (Exception e) {
            log.warn("Failed to parse reminder cron '{}': {}", cron, e.getMessage());
            return false;
        }
    }

    private boolean matchDow(String dowExpr, int currentDow) {
        // Handle range like "MON-FRI"
        if (dowExpr.contains("-")) {
            String[] range = dowExpr.split("-");
            int start = parseDow(range[0]);
            int end   = parseDow(range[1]);
            return currentDow >= start && currentDow <= end;
        }
        // Handle comma-separated or single value
        for (String part : dowExpr.split(",")) {
            if (parseDow(part.trim()) == currentDow) return true;
        }
        return false;
    }

    private int parseDow(String s) {
        return switch (s.toUpperCase()) {
            case "MON" -> 1; case "TUE" -> 2; case "WED" -> 3;
            case "THU" -> 4; case "FRI" -> 5; case "SAT" -> 6; case "SUN" -> 7;
            default -> Integer.parseInt(s);
        };
    }
}
