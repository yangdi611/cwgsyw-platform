package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleNotificationLog;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTask;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleNotificationLogMapper;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarNotificationService;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class OpsCalendarNotificationServiceTest {
    @Mock NotificationService notificationService;
    @Mock OpsScheduleNotificationLogMapper notificationLogMapper;
    @Mock UserMapper userMapper;
    @Mock GroupMapper groupMapper;
    @InjectMocks OpsCalendarNotificationService service;

    @Test
    void dailyReportCreatedNotificationUsesRuleTemplate() {
        OpsScheduleTask task = task("rule", "daily_report", "请在 {calendarDate} 提交 {taskTitle}");

        service.send(task, "created", List.of(8L));

        verify(notificationService).notify(eq("default"), eq(8L), eq("【运维日历】日报提醒"),
                eq("请在 2026-07-20 提交 日报提醒"), eq("ops_calendar"), eq("ops_task"), eq(42L));
        verify(notificationLogMapper).updateById(any(OpsScheduleNotificationLog.class));
    }

    @Test
    void manualDailyReportAndOtherStagesKeepDefaultTemplates() {
        OpsScheduleTask task = task("manual", "daily_report", "must not be used");

        service.send(task, "created", List.of(8L));

        verify(notificationService).notify(eq("default"), eq(8L), eq("【运维日历】日报提醒"),
                org.mockito.ArgumentMatchers.contains("新任务已生成"), eq("ops_calendar"), eq("ops_task"), eq(42L));
    }

    private OpsScheduleTask task(String sourceType, String taskType, String content) {
        OpsScheduleTask task = new OpsScheduleTask();
        task.setId(42L);
        task.setTenantId("default");
        task.setTitle("日报提醒");
        task.setSourceType(sourceType);
        task.setTaskType(taskType);
        task.setContent(content);
        task.setPlannedStartAt(LocalDateTime.of(2026, 7, 20, 17, 0));
        task.setDueAt(LocalDateTime.of(2026, 7, 20, 23, 59));
        return task;
    }
}
