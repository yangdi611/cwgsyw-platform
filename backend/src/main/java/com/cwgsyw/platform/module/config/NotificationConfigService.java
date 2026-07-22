package com.cwgsyw.platform.module.config;

import com.cwgsyw.platform.module.config.dto.NotificationConfigRequest;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarRuleService;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationConfigService {
    static final String DEFAULT_REMINDER_CRON = "0 0 17 * * MON-FRI";
    static final String DEFAULT_REMINDER_TEMPLATE = "【IT运维平台】您今日尚未提交工作日报，请尽快填写。";

    private final SysConfigService configService;
    private final OpsCalendarRuleService ruleService;

    @Transactional
    public void update(SecurityUser user, NotificationConfigRequest request) {
        if (request == null) throw new IllegalArgumentException("通知配置不能为空");

        String tenantId = user.getTenantId();
        boolean enabled = request.getReminderEnabled() != null
                ? request.getReminderEnabled()
                : configService.getBoolean(tenantId, "notify.reminder.enabled");
        String cron = request.getReminderCron() != null
                ? normalizeCron(request.getReminderCron())
                : normalizeCron(defaultIfBlank(configService.get(tenantId, "notify.reminder.cron"), DEFAULT_REMINDER_CRON));
        String template = request.getReminderTemplate() != null
                ? normalizeTemplate(request.getReminderTemplate())
                : normalizeTemplate(configService.get(tenantId, "notify.reminder.template"));

        ruleService.syncDailyReportReminder(user, enabled, cron, template);
        configService.set(tenantId, "notify.reminder.enabled", String.valueOf(enabled));
        configService.set(tenantId, "notify.reminder.cron", cron);
        configService.set(tenantId, "notify.reminder.template", template);
    }

    private String normalizeCron(String value) {
        String cron = value == null ? "" : value.trim();
        if (cron.isEmpty()) throw new IllegalArgumentException("日报提醒 Cron 表达式不能为空");
        try {
            CronExpression.parse(cron);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("日报提醒 Cron 表达式无效", exception);
        }
        return cron;
    }

    private String normalizeTemplate(String value) {
        String template = value == null ? "" : value.trim();
        return template.isEmpty() ? DEFAULT_REMINDER_TEMPLATE : template;
    }

    private String defaultIfBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
