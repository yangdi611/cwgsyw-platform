package com.cwgsyw.platform.module.opscalendar.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.opscalendar.entity.OpsDutyRoster;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleNotificationLog;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTask;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleNotificationLogMapper;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

/**
 * 运维日历通知发送服务。
 * 职责：模板 null-safe 渲染 + 通知幂等（ops_schedule_notification_log）+ 失败重试。
 * 见 spec 6.4 / 4.8。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OpsCalendarNotificationService {

    private final NotificationService notificationService;
    private final OpsScheduleNotificationLogMapper notificationLogMapper;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;

    private static final DateTimeFormatter DT_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    /** 每个阶段的默认标题/正文模板（{var} 占位）。 */
    private String defaultTitle(String stage) {
        return "【运维日历】{taskTitle}";
    }

    private String defaultBody(String stage) {
        return switch (stage) {
            case "created"    -> "新任务已生成：{taskTitle}\n负责人：{assigneeName}{assigneePhoneSuffix}\n计划时间：{startTime}\n截止时间：{dueTime}\n请及时确认并完成执行记录。";
            case "unconfirmed"-> "任务 {taskTitle} 尚未确认收到，请尽快确认。截止时间：{dueTime}。";
            case "due_today"  -> "任务 {taskTitle} 今日到期，请及时处理。截止时间：{dueTime}。";
            case "overdue"    -> "任务 {taskTitle} 已逾期，请尽快处理或说明原因。截止时间：{dueTime}。";
            case "escalation" -> "【升级提醒】任务 {taskTitle} 未按时确认或已逾期，负责人：{assigneeName}{assigneePhoneSuffix}，请关注。";
            case "completed"  -> "任务 {taskTitle} 已完成。";
            default           -> "任务 {taskTitle} 提醒。截止时间：{dueTime}。";
        };
    }

    /**
     * 向一批用户发送某阶段通知，逐用户幂等。
     * @param phoneOverride 排班场景下的电话覆盖，可为 null
     */
    public void send(OpsScheduleTask task, String stage, Collection<Long> userIds, String phoneOverride) {
        if (userIds == null || userIds.isEmpty()) return;
        for (Long userId : userIds) {
            if (userId == null) continue;
            try {
                sendOne(task, stage, userId, phoneOverride);
            } catch (Exception e) {
                log.error("ops-calendar notify failed task={} stage={} user={}: {}",
                        task.getId(), stage, userId, e.getMessage());
            }
        }
    }

    public void send(OpsScheduleTask task, String stage, Collection<Long> userIds) {
        send(task, stage, userIds, null);
    }

    /** 手动重发：stage 形如 manual:{ts}，不受幂等唯一键约束（每次都是新 stage）。 */
    public void sendManual(OpsScheduleTask task, Collection<Long> userIds) {
        String stage = "manual:" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        send(task, stage, userIds, null);
    }

    private void sendOne(OpsScheduleTask task, String stage, Long userId, String phoneOverride) {
        String tenantId = task.getTenantId();
        String channel = "notification";

        OpsScheduleNotificationLog existing = notificationLogMapper.selectOne(
                new LambdaQueryWrapper<OpsScheduleNotificationLog>()
                        .eq(OpsScheduleNotificationLog::getTaskId, task.getId())
                        .eq(OpsScheduleNotificationLog::getStage, stage)
                        .eq(OpsScheduleNotificationLog::getUserId, userId)
                        .eq(OpsScheduleNotificationLog::getChannel, channel)
                        .last("LIMIT 1"));

        // 已成功发送 -> 跳过
        if (existing != null && Boolean.TRUE.equals(existing.getSuccess())) {
            return;
        }

        // 不存在 -> 先插入待发送记录
        OpsScheduleNotificationLog logRow = existing;
        if (logRow == null) {
            logRow = new OpsScheduleNotificationLog();
            logRow.setTenantId(tenantId);
            logRow.setTaskId(task.getId());
            logRow.setStage(stage);
            logRow.setUserId(userId);
            logRow.setChannel(channel);
            logRow.setSuccess(false);
            logRow.setRetryCount(0);
            logRow.setCreatedAt(LocalDateTime.now());
            logRow.setUpdatedAt(LocalDateTime.now());
            try {
                notificationLogMapper.insert(logRow);
            } catch (Exception dup) {
                // 并发下唯一键冲突：说明另一线程已处理，跳过
                return;
            }
        }

        // 渲染并发送
        Map<String, String> vars = buildVars(task, userId, phoneOverride);
        String title = render(defaultTitle(stage), vars);
        String body = render(defaultBody(stage), vars);

        try {
            notificationService.notify(tenantId, userId, title, body,
                    "ops_calendar", "ops_task", task.getId());
            logRow.setSuccess(true);
            logRow.setSentAt(LocalDateTime.now());
            logRow.setErrorMessage(null);
            logRow.setUpdatedAt(LocalDateTime.now());
            notificationLogMapper.updateById(logRow);
        } catch (Exception e) {
            logRow.setSuccess(false);
            logRow.setRetryCount((logRow.getRetryCount() == null ? 0 : logRow.getRetryCount()) + 1);
            logRow.setErrorMessage(e.getMessage());
            logRow.setLastErrorAt(LocalDateTime.now());
            logRow.setUpdatedAt(LocalDateTime.now());
            notificationLogMapper.updateById(logRow);
            throw e;
        }
    }

    /** 构造模板变量，全部 null-safe。 */
    private Map<String, String> buildVars(OpsScheduleTask task, Long userId, String phoneOverride) {
        Map<String, String> vars = new HashMap<>();
        vars.put("taskTitle", safe(task.getTitle()));
        vars.put("taskType", safe(task.getTaskType()));

        // 负责人姓名/电话：优先 task.assignee，否则当前接收用户
        Long assigneeId = task.getAssigneeId() != null ? task.getAssigneeId() : userId;
        User assignee = assigneeId != null ? userMapper.selectById(assigneeId) : null;
        String assigneeName = assignee != null
                ? (notBlank(assignee.getRealName()) ? assignee.getRealName() : assignee.getUsername())
                : "";
        vars.put("assigneeName", safe(assigneeName));

        // 电话优先级：phoneOverride > user.phone > 空
        String phone = notBlank(phoneOverride) ? phoneOverride
                : (assignee != null && notBlank(assignee.getPhone()) ? assignee.getPhone() : "");
        vars.put("assigneePhone", safe(phone));
        // 带括号后缀：有电话渲染「（138...）」，无则整段省略
        vars.put("assigneePhoneSuffix", notBlank(phone) ? "（" + phone + "）" : "");

        vars.put("startTime", task.getPlannedStartAt() != null ? task.getPlannedStartAt().format(DT_FMT) : "待定");
        vars.put("dueTime", task.getDueAt() != null ? task.getDueAt().format(DT_FMT) : "待定");

        String groupName = "";
        if (task.getGroupId() != null) {
            Group g = groupMapper.selectById(task.getGroupId());
            if (g != null) groupName = safe(g.getName());
        }
        vars.put("groupName", groupName);

        if (task.getPlannedStartAt() != null) {
            int year = task.getPlannedStartAt().getYear();
            int q = (task.getPlannedStartAt().getMonthValue() - 1) / 3 + 1;
            vars.put("quarter", year + " Q" + q);
        } else {
            vars.put("quarter", "");
        }
        vars.put("calendarDate", task.getPlannedStartAt() != null
                ? task.getPlannedStartAt().toLocalDate().toString()
                : (task.getDueAt() != null ? task.getDueAt().toLocalDate().toString() : ""));
        return vars;
    }

    /** 替换 {var}；未提供的变量替换为空字符串，绝不输出 null 字面量。 */
    private String render(String template, Map<String, String> vars) {
        if (template == null) return "";
        String result = template;
        for (Map.Entry<String, String> e : vars.entrySet()) {
            result = result.replace("{" + e.getKey() + "}", e.getValue() == null ? "" : e.getValue());
        }
        // 清理残余未知占位符，避免渲染出 {xxx}
        result = result.replaceAll("\\{[a-zA-Z0-9_]+}", "");
        return result;
    }

    private String safe(String s) { return s == null ? "" : s; }
    private boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
