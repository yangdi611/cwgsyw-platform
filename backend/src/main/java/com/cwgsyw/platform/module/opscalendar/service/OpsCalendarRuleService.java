package com.cwgsyw.platform.module.opscalendar.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.opscalendar.dto.*;
import com.cwgsyw.platform.module.opscalendar.entity.*;
import com.cwgsyw.platform.module.opscalendar.mapper.*;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 周期规则服务：CRUD + 预览 + 任务生成（被 Scheduler 调用）。
 * 写操作同事务写 audit_log（spec 7.4），系统生成 operatorId=0L。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OpsCalendarRuleService {

    private final OpsScheduleRuleMapper ruleMapper;
    private final OpsScheduleTaskMapper taskMapper;
    private final OpsScheduleTaskParticipantMapper participantMapper;
    private final OpsScheduleChecklistItemMapper checklistMapper;
    private final OpsScheduleTaskLogMapper logMapper;
    private final OpsScheduleTemplateMapper templateMapper;
    private final OpsDutyRosterMapper rosterMapper;
    private final OccurrenceCalculator occurrenceCalculator;
    private final OpsCalendarNotificationService notificationService;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;
    private final RbacService rbacService;
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    // ============ helpers ============

    private void writeAudit(String tenantId, String action, Long targetId, Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("ops_calendar").action(action)
                .targetId(targetId).targetType("ops_schedule_rule")
                .operatorId(operatorId).remark(remark)
                .createdAt(LocalDateTime.now()).build());
    }

    private String toJson(Map<String, Object> m) {
        if (m == null) return "{}";
        try { return objectMapper.writeValueAsString(m); } catch (Exception e) { return "{}"; }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fromJson(String json) {
        if (json == null || json.isBlank()) return new HashMap<>();
        try { return objectMapper.readValue(json, Map.class); } catch (Exception e) { return new HashMap<>(); }
    }

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }

    // ============ CRUD ============

    public List<RuleVO> list(String tenantId) {
        return ruleMapper.selectList(new LambdaQueryWrapper<OpsScheduleRule>()
                        .eq(OpsScheduleRule::getTenantId, tenantId)
                        .orderByDesc(OpsScheduleRule::getCreatedAt))
                .stream().map(this::toVO).collect(Collectors.toList());
    }

    public RuleVO get(String tenantId, Long id) {
        OpsScheduleRule r = ruleMapper.selectById(id);
        if (r == null || !tenantId.equals(r.getTenantId())) throw new IllegalArgumentException("规则不存在");
        return toVO(r);
    }

    private RuleVO toVO(OpsScheduleRule r) {
        RuleVO vo = new RuleVO();
        vo.setId(r.getId());
        vo.setName(r.getName());
        vo.setDescription(r.getDescription());
        vo.setTaskType(r.getTaskType());
        vo.setEnabled(r.getEnabled());
        vo.setTriggerType(r.getTriggerType());
        vo.setTriggerConfig(fromJson(r.getTriggerConfig()));
        vo.setGenerateDaysAhead(r.getGenerateDaysAhead());
        vo.setReminderConfig(fromJson(r.getReminderConfig()));
        vo.setDueConfig(fromJson(r.getDueConfig()));
        vo.setAssigneeRule(fromJson(r.getAssigneeRule()));
        vo.setRecipientRule(fromJson(r.getRecipientRule()));
        vo.setEscalationRule(fromJson(r.getEscalationRule()));
        vo.setTemplateId(r.getTemplateId());
        vo.setChecklistTemplateId(r.getChecklistTemplateId());
        vo.setVisibility(r.getVisibility());
        vo.setPublicSummary(r.getPublicSummary());
        vo.setSensitive(r.getSensitive());
        vo.setNextGenerateAt(r.getNextGenerateAt());
        vo.setLastGeneratedAt(r.getLastGeneratedAt());
        vo.setCreatedAt(r.getCreatedAt());
        return vo;
    }

    @Transactional
    public Long create(SecurityUser user, RuleCreateRequest req) {
        if (!notBlank(req.getName())) throw new IllegalArgumentException("规则名称必填");
        if (!notBlank(req.getTaskType())) throw new IllegalArgumentException("任务类型必填");
        if (!notBlank(req.getTriggerType())) throw new IllegalArgumentException("触发类型必填");

        OpsScheduleRule r = new OpsScheduleRule();
        r.setTenantId(user.getTenantId());
        applyRequest(r, req);
        r.setEnabled(req.getEnabled() == null || req.getEnabled());
        // 首轮立即扫描
        r.setNextGenerateAt(null);
        ruleMapper.insert(r);

        writeAudit(user.getTenantId(), "create", r.getId(), user.getUserId(), "name=" + r.getName());
        return r.getId();
    }

    @Transactional
    public void update(SecurityUser user, Long id, RuleCreateRequest req) {
        OpsScheduleRule r = ruleMapper.selectById(id);
        if (r == null || !user.getTenantId().equals(r.getTenantId())) throw new IllegalArgumentException("规则不存在");
        applyRequest(r, req);
        // 触发配置可能变化 -> 重置下次扫描点为立即
        r.setNextGenerateAt(null);
        ruleMapper.updateById(r);
        writeAudit(user.getTenantId(), "update", id, user.getUserId(), "name=" + r.getName());
    }

    private void applyRequest(OpsScheduleRule r, RuleCreateRequest req) {
        if (notBlank(req.getName())) r.setName(req.getName());
        r.setDescription(req.getDescription());
        if (notBlank(req.getTaskType())) r.setTaskType(req.getTaskType());
        if (notBlank(req.getTriggerType())) r.setTriggerType(req.getTriggerType());
        if (req.getTriggerConfig() != null) r.setTriggerConfig(toJson(req.getTriggerConfig()));
        if (req.getGenerateDaysAhead() != null) r.setGenerateDaysAhead(req.getGenerateDaysAhead());
        if (req.getReminderConfig() != null) r.setReminderConfig(toJson(req.getReminderConfig()));
        if (req.getDueConfig() != null) r.setDueConfig(toJson(req.getDueConfig()));
        if (req.getAssigneeRule() != null) r.setAssigneeRule(toJson(req.getAssigneeRule()));
        if (req.getRecipientRule() != null) r.setRecipientRule(toJson(req.getRecipientRule()));
        if (req.getEscalationRule() != null) r.setEscalationRule(toJson(req.getEscalationRule()));
        if (req.getTemplateId() != null) r.setTemplateId(req.getTemplateId());
        if (req.getChecklistTemplateId() != null) r.setChecklistTemplateId(req.getChecklistTemplateId());
        if (notBlank(req.getVisibility())) r.setVisibility(req.getVisibility());
        r.setPublicSummary(req.getPublicSummary());
        if (req.getSensitive() != null) r.setSensitive(req.getSensitive());
    }

    @Transactional
    public void setEnabled(SecurityUser user, Long id, boolean enabled) {
        OpsScheduleRule r = ruleMapper.selectById(id);
        if (r == null || !user.getTenantId().equals(r.getTenantId())) throw new IllegalArgumentException("规则不存在");
        r.setEnabled(enabled);
        if (enabled) r.setNextGenerateAt(null); // 重新启用立即扫描
        ruleMapper.updateById(r);
        writeAudit(user.getTenantId(), "update", id, user.getUserId(), enabled ? "enable" : "disable");
    }

    @Transactional
    public void delete(SecurityUser user, Long id) {
        OpsScheduleRule r = ruleMapper.selectById(id);
        if (r == null || !user.getTenantId().equals(r.getTenantId())) throw new IllegalArgumentException("规则不存在");
        r.setDeletedAt(LocalDateTime.now());
        r.setDeletedBy(user.getUserId());
        ruleMapper.updateById(r);
        ruleMapper.deleteById(id);
        writeAudit(user.getTenantId(), "delete", id, user.getUserId(), "name=" + r.getName());
    }

    // ============ 5.9 预览 ============

    public List<RulePreviewVO> preview(SecurityUser user, RuleCreateRequest req) {
        OpsScheduleRule r = new OpsScheduleRule();
        r.setTenantId(user.getTenantId());
        applyRequest(r, req);
        LocalDateTime now = LocalDateTime.now();
        // 预览未来一年，最多取 6 次
        List<LocalDateTime> occ = occurrenceCalculator.calculate(r, now, now.plusYears(1));
        List<RulePreviewVO> out = new ArrayList<>();
        for (int i = 0; i < Math.min(occ.size(), 6); i++) {
            LocalDateTime start = occ.get(i);
            LocalDateTime due = computeDue(r, start);
            out.add(new RulePreviewVO(start, due, buildTitle(r, start), "preview:" + i));
        }
        return out;
    }

    // ============ 6.2 生成任务实例（被 Scheduler 调用，operatorId=0L） ============

    /** 为单个规则生成窗口内任务，返回新建任务数。 */
    @Transactional
    public int generateForRule(OpsScheduleRule rule, LocalDateTime now) {
        int created = 0;
        LocalDateTime windowEnd = now.plusDays(rule.getGenerateDaysAhead() == null ? 7 : rule.getGenerateDaysAhead());
        List<LocalDateTime> occurrences = occurrenceCalculator.calculate(rule, now, windowEnd);

        for (LocalDateTime start : occurrences) {
            Long assigneeId = resolveAssignee(rule, start);
            String occKey = rule.getId() + ":" + start.toLocalDate() + ":" + rule.getTaskType()
                    + ":" + (assigneeId != null ? "u" + assigneeId : "g" + (rule.getVisibility()));
            // 幂等：占用唯一键则跳过
            Long exist = taskMapper.selectCount(new LambdaQueryWrapper<OpsScheduleTask>()
                    .eq(OpsScheduleTask::getTenantId, rule.getTenantId())
                    .eq(OpsScheduleTask::getRuleId, rule.getId())
                    .eq(OpsScheduleTask::getOccurrenceKey, occKey));
            if (exist != null && exist > 0) continue;

            OpsScheduleTask t = new OpsScheduleTask();
            t.setTenantId(rule.getTenantId());
            t.setRuleId(rule.getId());
            t.setOccurrenceKey(occKey);
            t.setTitle(buildTitle(rule, start));
            t.setTaskType(rule.getTaskType());
            t.setSourceType("rule");
            t.setStatus("pending_confirm");
            t.setPlannedStartAt(start);
            t.setDueAt(computeDue(rule, start));
            t.setAssigneeId(assigneeId);
            t.setGroupId(resolveGroupId(rule));
            t.setPriority("normal");
            t.setContent(rule.getDescription());
            t.setVisibility(rule.getVisibility());
            t.setPublicSummary(rule.getPublicSummary());
            t.setSensitive(Boolean.TRUE.equals(rule.getSensitive()));
            t.setCreatedBy(0L);
            t.setUpdatedBy(0L);
            try {
                taskMapper.insert(t);
            } catch (Exception dup) {
                continue; // 并发唯一键冲突
            }

            if (assigneeId != null) addParticipant(t.getId(), rule.getTenantId(), assigneeId, "assignee");
            copyChecklistTemplate(rule, t);

            writeTaskLog(t.getId(), rule.getTenantId(), "create", 0L, "调度生成");
            auditLogMapper.insert(AuditLog.builder()
                    .tenantId(rule.getTenantId()).module("ops_calendar").action("generate")
                    .targetId(t.getId()).targetType("ops_schedule_task")
                    .operatorId(0L).remark("rule=" + rule.getId()).createdAt(LocalDateTime.now()).build());

            // created 通知：assignee + 接收人解析
            Set<Long> recipients = resolveCreatedRecipients(rule, t, start);
            notificationService.send(t, "created", recipients);
            created++;
        }

        rule.setLastGeneratedAt(now);
        rule.setNextGenerateAt(computeNextScanPoint(rule, now, windowEnd));
        ruleMapper.updateById(rule);
        return created;
    }

    /** 计算下一次扫描点：窗口外的下一个 occurrence 提前 generateDaysAhead；无则按粒度顺延。 */
    private LocalDateTime computeNextScanPoint(OpsScheduleRule rule, LocalDateTime now, LocalDateTime windowEnd) {
        int ahead = rule.getGenerateDaysAhead() == null ? 7 : rule.getGenerateDaysAhead();
        List<LocalDateTime> future = occurrenceCalculator.calculate(rule, windowEnd, now.plusYears(2));
        if (!future.isEmpty()) {
            LocalDateTime nextOcc = future.get(0);
            LocalDateTime scan = nextOcc.minusDays(ahead);
            return scan.isBefore(now.plusMinutes(1)) ? now.plusMinutes(1) : scan;
        }
        // 无未来 occurrence（如 once 已生成）：1 天后再看一次兜底
        return now.plusDays(1);
    }

    private String buildTitle(OpsScheduleRule rule, LocalDateTime start) {
        // {quarter}/{period} 简单替换
        int q = (start.getMonthValue() - 1) / 3 + 1;
        String name = rule.getName();
        if ("report".equals(rule.getTaskType()) && "quarterly".equals(rule.getTriggerType())) {
            return start.getYear() + " Q" + q + " " + name;
        }
        return name + "（" + start.toLocalDate() + "）";
    }

    private LocalDateTime computeDue(OpsScheduleRule rule, LocalDateTime start) {
        Map<String, Object> due = fromJson(rule.getDueConfig());
        int offsetDays = 0;
        Object od = due.get("offsetDays");
        if (od instanceof Number n) offsetDays = n.intValue();
        String time = due.get("time") != null ? String.valueOf(due.get("time")) : "18:00";
        java.time.LocalTime lt;
        try { lt = java.time.LocalTime.parse(time); } catch (Exception e) { lt = java.time.LocalTime.of(18, 0); }
        return LocalDateTime.of(start.toLocalDate().plusDays(offsetDays), lt);
    }

    private Long resolveGroupId(OpsScheduleRule rule) {
        Map<String, Object> ar = fromJson(rule.getAssigneeRule());
        Object gid = ar.get("groupId");
        if (gid instanceof Number n) return n.longValue();
        return null;
    }

    /** 负责人解析。type: fixed | group_leader | creator | assignee | roster_next_week | unsubmitted_daily_report */
    private Long resolveAssignee(OpsScheduleRule rule, LocalDateTime start) {
        Map<String, Object> ar = fromJson(rule.getAssigneeRule());
        String type = ar.get("type") != null ? String.valueOf(ar.get("type")) : "creator";
        switch (type) {
            case "fixed": {
                Object uid = ar.get("userId");
                return uid instanceof Number n ? n.longValue() : null;
            }
            case "group_leader": {
                Long gid = resolveGroupId(rule);
                return findGroupLeader(rule.getTenantId(), gid);
            }
            case "roster_next_week":
                return findRosterAssignee(rule.getTenantId(), start.toLocalDate());
            case "unsubmitted_daily_report":
                return null; // 汇总任务，无单一负责人
            case "creator":
            default:
                return rule.getCreatedBy() != null && rule.getCreatedBy() != 0L ? rule.getCreatedBy() : null;
        }
    }

    private Long findGroupLeader(String tenantId, Long groupId) {
        if (groupId == null) return null;
        // 找该组中拥有 group_leader 角色的用户
        List<User> users = userMapper.selectList(new LambdaQueryWrapper<User>()
                .eq(User::getTenantId, tenantId).eq(User::getGroupId, groupId));
        for (User u : users) {
            List<Long> roleIds = rbacService.getUserRoleIds(u.getId());
            // group_leader 角色 id 未知，这里用权限近似：含 read_group 视为组长
            if (rbacService.getUserPermissions(u.getId()).contains("ops_calendar:read_group")) return u.getId();
        }
        return users.isEmpty() ? null : users.get(0).getId();
    }

    private Long findRosterAssignee(String tenantId, LocalDate date) {
        // 取下周一对应排班负责人（简化：取 date 当天或之后最近一条排班）
        OpsDutyRoster roster = rosterMapper.selectOne(new LambdaQueryWrapper<OpsDutyRoster>()
                .eq(OpsDutyRoster::getTenantId, tenantId)
                .ge(OpsDutyRoster::getDutyDate, date)
                .orderByAsc(OpsDutyRoster::getDutyDate)
                .last("LIMIT 1"));
        return roster != null ? roster.getAssigneeId() : null;
    }

    /** created 阶段接收人解析。daily_report 汇总任务扇出给当天未提交用户由 handler 注入。 */
    private Set<Long> resolveCreatedRecipients(OpsScheduleRule rule, OpsScheduleTask task, LocalDateTime start) {
        Set<Long> out = new LinkedHashSet<>();
        if (task.getAssigneeId() != null) out.add(task.getAssigneeId());
        Map<String, Object> rr = fromJson(rule.getRecipientRule());
        String type = rr.get("type") != null ? String.valueOf(rr.get("type")) : "assignee";
        if ("unsubmitted_daily_report".equals(type)) {
            out.addAll(findUnsubmittedDailyReportUsers(rule.getTenantId(), start.toLocalDate()));
        } else if ("group".equals(type)) {
            Long gid = resolveGroupId(rule);
            if (gid != null) {
                userMapper.selectList(new LambdaQueryWrapper<User>()
                                .eq(User::getTenantId, rule.getTenantId()).eq(User::getGroupId, gid))
                        .forEach(u -> out.add(u.getId()));
            }
        }
        return out;
    }

    /** 当天未提交日报用户（spec 9.2 扇出）。注入 DailyReport 查询以避免重复 scheduler。 */
    private final java.util.concurrent.atomic.AtomicReference<UnsubmittedResolver> unsubmittedResolverRef =
            new java.util.concurrent.atomic.AtomicReference<>();

    public interface UnsubmittedResolver {
        Collection<Long> resolve(String tenantId, LocalDate date);
    }

    public void setUnsubmittedResolver(UnsubmittedResolver resolver) {
        unsubmittedResolverRef.set(resolver);
    }

    private Collection<Long> findUnsubmittedDailyReportUsers(String tenantId, LocalDate date) {
        UnsubmittedResolver r = unsubmittedResolverRef.get();
        return r != null ? r.resolve(tenantId, date) : List.of();
    }

    private void addParticipant(Long taskId, String tenantId, Long userId, String role) {
        if (userId == null) return;
        OpsScheduleTaskParticipant p = new OpsScheduleTaskParticipant();
        p.setTenantId(tenantId);
        p.setTaskId(taskId);
        p.setUserId(userId);
        p.setRole(role);
        p.setCreatedAt(LocalDateTime.now());
        try { participantMapper.insert(p); } catch (Exception ignore) {}
    }

    private void copyChecklistTemplate(OpsScheduleRule rule, OpsScheduleTask task) {
        if (rule.getChecklistTemplateId() == null) return;
        OpsScheduleTemplate tpl = templateMapper.selectById(rule.getChecklistTemplateId());
        if (tpl == null || !notBlank(tpl.getChecklistJson())) return;
        try {
            List<Map<String, Object>> items = objectMapper.readValue(tpl.getChecklistJson(), List.class);
            int order = 0;
            for (Map<String, Object> m : items) {
                OpsScheduleChecklistItem item = new OpsScheduleChecklistItem();
                item.setTenantId(rule.getTenantId());
                item.setTaskId(task.getId());
                item.setTitle(String.valueOf(m.getOrDefault("title", "检查项")));
                item.setRequired(Boolean.TRUE.equals(m.get("required")));
                item.setInputType(m.get("inputType") != null ? String.valueOf(m.get("inputType")) : "checkbox");
                item.setOptions(m.get("options") != null ? String.valueOf(m.get("options")) : null);
                item.setChecked(false);
                item.setSortOrder(order++);
                item.setCreatedAt(LocalDateTime.now());
                item.setUpdatedAt(LocalDateTime.now());
                checklistMapper.insert(item);
            }
        } catch (Exception e) {
            log.warn("copy checklist template failed rule={}: {}", rule.getId(), e.getMessage());
        }
    }

    private void writeTaskLog(Long taskId, String tenantId, String action, Long operatorId, String content) {
        OpsScheduleTaskLog row = new OpsScheduleTaskLog();
        row.setTenantId(tenantId);
        row.setTaskId(taskId);
        row.setAction(action);
        row.setOperatorId(operatorId);
        row.setContent(content);
        row.setCreatedAt(LocalDateTime.now());
        logMapper.insert(row);
    }

    /** 供 Scheduler 取「到点该生成」的规则。 */
    public List<OpsScheduleRule> dueRules(LocalDateTime now) {
        return ruleMapper.selectList(new LambdaQueryWrapper<OpsScheduleRule>()
                .eq(OpsScheduleRule::getEnabled, true)
                .and(w -> w.isNull(OpsScheduleRule::getNextGenerateAt)
                        .or().le(OpsScheduleRule::getNextGenerateAt, now)));
    }
}
