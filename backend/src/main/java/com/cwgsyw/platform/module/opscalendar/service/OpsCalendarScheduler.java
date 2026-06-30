package com.cwgsyw.platform.module.opscalendar.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleRule;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTask;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTaskLog;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTaskParticipant;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskLogMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskParticipantMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 运维日历统一调度器。每分钟 tick：
 *  1. 生成任务（仅扫描 next_generate_at <= now 的规则，命中部分索引，spec 6.2）
 *  2. 到期/提前提醒
 *  3. 逾期标记
 *  4. 未确认/逾期升级
 * 所有写操作幂等；系统操作 operatorId=0L 写 audit_log（spec 7.4）。
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OpsCalendarScheduler {

    private final OpsCalendarRuleService ruleService;
    private final OpsScheduleTaskMapper taskMapper;
    private final OpsScheduleTaskLogMapper logMapper;
    private final OpsScheduleTaskParticipantMapper participantMapper;
    private final OpsCalendarNotificationService notificationService;
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    @Scheduled(cron = "0 * * * * *")
    public void tick() {
        LocalDateTime now = LocalDateTime.now();
        try { generateUpcomingTasks(now); } catch (Exception e) { log.error("generate tasks failed: {}", e.getMessage(), e); }
        try { sendDueNotifications(now); } catch (Exception e) { log.error("due notifications failed: {}", e.getMessage(), e); }
        try { markOverdueTasks(now); } catch (Exception e) { log.error("mark overdue failed: {}", e.getMessage(), e); }
        try { escalate(now); } catch (Exception e) { log.error("escalate failed: {}", e.getMessage(), e); }
    }

    // ---- 1. 生成 ----
    private void generateUpcomingTasks(LocalDateTime now) {
        List<OpsScheduleRule> rules = ruleService.dueRules(now);
        int total = 0;
        for (OpsScheduleRule rule : rules) {
            try {
                total += ruleService.generateForRule(rule, now);
            } catch (Exception e) {
                log.error("generateForRule {} failed: {}", rule.getId(), e.getMessage());
            }
        }
        if (total > 0) log.info("ops-calendar generated {} tasks", total);
    }

    // ---- 2. 提醒：到期当天 / 提前 ----
    private void sendDueNotifications(LocalDateTime now) {
        LocalDateTime dayStart = now.toLocalDate().atStartOfDay();
        LocalDateTime dayEnd = dayStart.plusDays(1);
        // 今日到期且未完成 -> due_today
        List<OpsScheduleTask> dueToday = taskMapper.selectList(new LambdaQueryWrapper<OpsScheduleTask>()
                .in(OpsScheduleTask::getStatus, "pending_confirm", "not_started", "in_progress")
                .between(OpsScheduleTask::getDueAt, dayStart, dayEnd));
        for (OpsScheduleTask t : dueToday) {
            notificationService.send(t, "due_today", recipients(t));
        }
    }

    // ---- 3. 逾期标记 ----
    private void markOverdueTasks(LocalDateTime now) {
        List<OpsScheduleTask> overdue = taskMapper.selectList(new LambdaQueryWrapper<OpsScheduleTask>()
                .in(OpsScheduleTask::getStatus, "pending_confirm", "not_started", "in_progress")
                .lt(OpsScheduleTask::getDueAt, now));
        for (OpsScheduleTask t : overdue) {
            t.setStatus("overdue");
            taskMapper.updateById(t);
            writeLog(t.getId(), t.getTenantId(), "overdue", 0L, "系统标记逾期");
            audit(t.getTenantId(), "overdue", t.getId());
            notificationService.send(t, "overdue", recipients(t));
        }
        if (!overdue.isEmpty()) log.info("ops-calendar marked {} overdue", overdue.size());
    }

    // ---- 4. 升级：未确认 + 逾期 ----
    private void escalate(LocalDateTime now) {
        // 未确认升级：pending_confirm 且 created_at + unconfirmedHours < now
        List<OpsScheduleTask> pending = taskMapper.selectList(new LambdaQueryWrapper<OpsScheduleTask>()
                .eq(OpsScheduleTask::getStatus, "pending_confirm")
                .isNotNull(OpsScheduleTask::getRuleId));
        for (OpsScheduleTask t : pending) {
            long hours = unconfirmedHours(t);
            if (hours <= 0 || t.getCreatedAt() == null) continue;
            if (t.getCreatedAt().plusHours(hours).isBefore(now)) {
                notificationService.send(t, "unconfirmed", recipients(t));
                Set<Long> escUsers = escalationUsers(t);
                if (!escUsers.isEmpty()) notificationService.send(t, "escalation", escUsers);
            }
        }
        // 逾期升级
        List<OpsScheduleTask> overdue = taskMapper.selectList(new LambdaQueryWrapper<OpsScheduleTask>()
                .eq(OpsScheduleTask::getStatus, "overdue"));
        for (OpsScheduleTask t : overdue) {
            Set<Long> escUsers = escalationUsers(t);
            if (!escUsers.isEmpty()) notificationService.send(t, "escalation", escUsers);
        }
    }

    // ---- helpers ----
    private long unconfirmedHours(OpsScheduleTask t) {
        // MVP：未确认升级默认 24h（后续可从规则 escalationRule.unconfirmedHours 读取）
        return 24;
    }

    private Set<Long> recipients(OpsScheduleTask t) {
        Set<Long> out = new LinkedHashSet<>();
        if (t.getAssigneeId() != null) out.add(t.getAssigneeId());
        participantMapper.selectList(new LambdaQueryWrapper<OpsScheduleTaskParticipant>()
                        .eq(OpsScheduleTaskParticipant::getTaskId, t.getId())
                        .in(OpsScheduleTaskParticipant::getRole, "assignee", "recipient"))
                .forEach(p -> out.add(p.getUserId()));
        return out;
    }

    private Set<Long> escalationUsers(OpsScheduleTask t) {
        return participantMapper.selectList(new LambdaQueryWrapper<OpsScheduleTaskParticipant>()
                        .eq(OpsScheduleTaskParticipant::getTaskId, t.getId())
                        .eq(OpsScheduleTaskParticipant::getRole, "escalation"))
                .stream().map(OpsScheduleTaskParticipant::getUserId).collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private void writeLog(Long taskId, String tenantId, String action, Long operatorId, String content) {
        OpsScheduleTaskLog row = new OpsScheduleTaskLog();
        row.setTenantId(tenantId);
        row.setTaskId(taskId);
        row.setAction(action);
        row.setOperatorId(operatorId);
        row.setContent(content);
        row.setCreatedAt(LocalDateTime.now());
        logMapper.insert(row);
    }

    private void audit(String tenantId, String action, Long taskId) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("ops_calendar").action(action)
                .targetId(taskId).targetType("ops_schedule_task")
                .operatorId(0L).createdAt(LocalDateTime.now()).build());
    }
}
