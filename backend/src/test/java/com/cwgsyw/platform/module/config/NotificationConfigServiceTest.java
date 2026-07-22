package com.cwgsyw.platform.module.config;

import com.cwgsyw.platform.module.config.dto.NotificationConfigRequest;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarRuleService;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;

@ExtendWith(MockitoExtension.class)
class NotificationConfigServiceTest {
    @Mock private SysConfigService configService;
    @Mock private OpsCalendarRuleService ruleService;

    @Test
    void updateSynchronizesFormalRuleBeforeCompatibilityKeys() {
        NotificationConfigService service = new NotificationConfigService(configService, ruleService);
        NotificationConfigRequest request = new NotificationConfigRequest();
        request.setReminderEnabled(false);
        request.setReminderCron(" 0 7 3 * * MON-FRI ");
        request.setReminderTemplate("  提醒 {calendarDate}  ");

        service.update(user(), request);

        InOrder writes = inOrder(ruleService, configService);
        writes.verify(ruleService).syncDailyReportReminder(any(SecurityUser.class), eq(false),
                eq("0 7 3 * * MON-FRI"), eq("提醒 {calendarDate}"));
        writes.verify(configService).set("default", "notify.reminder.enabled", "false");
        writes.verify(configService).set("default", "notify.reminder.cron", "0 7 3 * * MON-FRI");
        writes.verify(configService).set("default", "notify.reminder.template", "提醒 {calendarDate}");
    }

    @Test
    void invalidCronIsRejectedBeforeAnyWrite() {
        NotificationConfigService service = new NotificationConfigService(configService, ruleService);
        NotificationConfigRequest request = new NotificationConfigRequest();
        request.setReminderCron("not-a-cron");

        assertThatIllegalArgumentException().isThrownBy(() -> service.update(user(), request));

        verify(ruleService, never()).syncDailyReportReminder(any(SecurityUser.class), anyBoolean(), any(String.class), any(String.class));
        verify(configService, never()).set("default", "notify.reminder.cron", "not-a-cron");
    }

    @Test
    void blankTemplateUsesStableDefault() {
        NotificationConfigService service = new NotificationConfigService(configService, ruleService);
        NotificationConfigRequest request = new NotificationConfigRequest();
        request.setReminderEnabled(true);
        request.setReminderCron("0 0 17 * * MON-FRI");
        request.setReminderTemplate("   ");

        service.update(user(), request);

        verify(ruleService).syncDailyReportReminder(any(SecurityUser.class), eq(true),
                eq("0 0 17 * * MON-FRI"), eq(NotificationConfigService.DEFAULT_REMINDER_TEMPLATE));
    }

    private SecurityUser user() {
        return new SecurityUser(1L, "config-admin", "", "default", 1L, "platform", Set.of());
    }
}
