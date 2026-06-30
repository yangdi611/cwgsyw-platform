package com.cwgsyw.platform.module.opscalendar.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.opscalendar.dto.*;
import com.cwgsyw.platform.module.opscalendar.entity.*;
import com.cwgsyw.platform.module.opscalendar.mapper.*;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 运维日历任务核心服务：CRUD + 状态机 + 日历查询 + 当日工作项 + 工作台 + 详情。
 * 写操作同事务写 audit_log（spec 7.4）+ 领域时间线 ops_schedule_task_log。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OpsCalendarTaskService {

    private final OpsScheduleTaskMapper taskMapper;
    private final OpsScheduleTaskParticipantMapper participantMapper;
    private final OpsScheduleChecklistItemMapper checklistMapper;
    private final OpsScheduleTaskLogMapper logMapper;
    private final OpsScheduleTaskLinkMapper linkMapper;
    private final OpsCalendarVisibilityService visibilityService;
    private final OpsCalendarNotificationService notificationService;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;
    private final AuditLogMapper auditLogMapper;

    // ============ helpers ============

    private void writeAudit(String tenantId, String action, Long targetId, Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("ops_calendar").action(action)
                .targetId(targetId).targetType("ops_schedule_task")
                .operatorId(operatorId).remark(remark)
                .createdAt(LocalDateTime.now()).build());
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

    private String userName(Long userId, Map<Long, User> cache) {
        if (userId == null) return null;
        User u = cache != null ? cache.get(userId) : userMapper.selectById(userId);
        if (u == null) return null;
        return notBlank(u.getRealName()) ? u.getRealName() : u.getUsername();
    }

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }

    private List<Long> participantUserIds(Long taskId) {
        return participantMapper.selectList(new LambdaQueryWrapper<OpsScheduleTaskParticipant>()
                        .eq(OpsScheduleTaskParticipant::getTaskId, taskId))
                .stream().map(OpsScheduleTaskParticipant::getUserId).distinct().collect(Collectors.toList());
    }

    // ============ VO building ============

    public TaskVO toVO(OpsScheduleTask t, SecurityUser user, Map<Long, User> userCache, Map<Long, Group> groupCache) {
        TaskVO vo = new TaskVO();
        vo.setId(t.getId());
        vo.setRuleId(t.getRuleId());
        vo.setTaskType(t.getTaskType());
        vo.setStatus(t.getStatus());
        vo.setPlannedStartAt(t.getPlannedStartAt());
        vo.setDueAt(t.getDueAt());
        vo.setAssigneeId(t.getAssigneeId());
        vo.setGroupId(t.getGroupId());
        vo.setPriority(t.getPriority());
        vo.setSourceType(t.getSourceType());
        vo.setVisibility(t.getVisibility());
        vo.setSensitive(t.getSensitive());
        vo.setResultStatus(t.getResultStatus());
        vo.setRiskLevel(t.getRiskLevel());
        vo.setCompletedAt(t.getCompletedAt());

        List<Long> pids = participantUserIds(t.getId());
        boolean canView = visibilityService.canViewDetail(t, user, pids);
        boolean canOp = visibilityService.canOperate(t, user, pids);
        vo.setCanViewDetail(canView);
        vo.setCanOperate(canOp);

        // 敏感任务且无详情权限：标题降级为 publicSummary
        if (Boolean.TRUE.equals(t.getSensitive()) && !canView) {
            vo.setTitle(notBlank(t.getPublicSummary()) ? t.getPublicSummary() : "（敏感任务）");
            vo.setPublicSummary(t.getPublicSummary());
        } else {
            vo.setTitle(t.getTitle());
            vo.setPublicSummary(t.getPublicSummary());
            if (canView) {
                vo.setAssigneeName(userName(t.getAssigneeId(), userCache));
                if (t.getAssigneeId() != null) {
                    User u = userCache != null ? userCache.get(t.getAssigneeId()) : userMapper.selectById(t.getAssigneeId());
                    if (u != null) vo.setAssigneePhone(u.getPhone());
                }
                if (t.getGroupId() != null) {
                    Group g = groupCache != null ? groupCache.get(t.getGroupId()) : groupMapper.selectById(t.getGroupId());
                    if (g != null) vo.setGroupName(g.getName());
                }
            }
        }
        return vo;
    }

    // ============ 5.1 任务列表 ============

    public List<TaskVO> listTasks(SecurityUser user, LocalDate startDate, LocalDate endDate,
                                  String requestedScope, String taskType, String status,
                                  Long assigneeId, Long groupId) {
        if (startDate == null || endDate == null) throw new IllegalArgumentException("startDate/endDate 必填");
        if (startDate.plusDays(120).isBefore(endDate)) throw new IllegalArgumentException("查询跨度不能超过 120 天");

        String scope = visibilityService.resolveScope(user, requestedScope);
        LocalDateTime from = startDate.atStartOfDay();
        LocalDateTime to = endDate.plusDays(1).atStartOfDay();

        LambdaQueryWrapper<OpsScheduleTask> qw = new LambdaQueryWrapper<OpsScheduleTask>()
                .eq(OpsScheduleTask::getTenantId, user.getTenantId())
                // 落在日历范围内：planned_start 或 due 任一在区间内
                .and(w -> w.between(OpsScheduleTask::getPlannedStartAt, from, to)
                        .or().between(OpsScheduleTask::getDueAt, from, to))
                .eq(notBlank(taskType), OpsScheduleTask::getTaskType, taskType)
                .eq(notBlank(status), OpsScheduleTask::getStatus, status)
                .eq(assigneeId != null, OpsScheduleTask::getAssigneeId, assigneeId)
                .orderByAsc(OpsScheduleTask::getPlannedStartAt);
        visibilityService.applyVisibility(qw, user, scope, groupId);

        List<OpsScheduleTask> tasks = taskMapper.selectList(qw);
        return buildVOs(tasks, user);
    }

    private List<TaskVO> buildVOs(List<OpsScheduleTask> tasks, SecurityUser user) {
        if (tasks.isEmpty()) return List.of();
        Map<Long, User> userCache = new HashMap<>();
        Map<Long, Group> groupCache = new HashMap<>();
        Set<Long> uids = tasks.stream().map(OpsScheduleTask::getAssigneeId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<Long> gids = tasks.stream().map(OpsScheduleTask::getGroupId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!uids.isEmpty()) userMapper.selectBatchIds(uids).forEach(u -> userCache.put(u.getId(), u));
        if (!gids.isEmpty()) groupMapper.selectBatchIds(gids).forEach(g -> groupCache.put(g.getId(), g));
        return tasks.stream().map(t -> toVO(t, user, userCache, groupCache)).collect(Collectors.toList());
    }

    // ============ 5.2 当日工作项 ============

    public DayTasksVO dayTasks(SecurityUser user, LocalDate date, String requestedScope) {
        List<TaskVO> all = listTasks(user, date, date, requestedScope, null, null, null, null);

        DayTasksVO vo = new DayTasksVO();
        vo.setDate(date.toString());
        vo.setDayOfWeek(date.getDayOfWeek().name());

        DayTasksVO.Summary summary = new DayTasksVO.Summary();
        summary.setTotal(all.size());
        summary.setPending((int) all.stream().filter(t -> "pending_confirm".equals(t.getStatus())).count());
        summary.setOverdue((int) all.stream().filter(t -> "overdue".equals(t.getStatus())).count());
        summary.setCompleted((int) all.stream().filter(t -> "completed".equals(t.getStatus())).count());
        vo.setSummary(summary);

        List<TaskVO> todo = new ArrayList<>(), overdue = new ArrayList<>(),
                roster = new ArrayList<>(), publicNodes = new ArrayList<>(), completed = new ArrayList<>();
        for (TaskVO t : all) {
            if ("completed".equals(t.getStatus())) completed.add(t);
            else if ("overdue".equals(t.getStatus())) overdue.add(t);
            else if ("roster".equals(t.getTaskType())) roster.add(t);
            else if ("public".equals(t.getVisibility())) publicNodes.add(t);
            else todo.add(t);
        }
        List<DayTasksVO.Group> groups = new ArrayList<>();
        groups.add(new DayTasksVO.Group("todo", "待处理", todo));
        groups.add(new DayTasksVO.Group("overdue", "已逾期", overdue));
        groups.add(new DayTasksVO.Group("roster", "排班值守", roster));
        groups.add(new DayTasksVO.Group("public", "公共节点", publicNodes));
        groups.add(new DayTasksVO.Group("completed", "已完成", completed));
        vo.setGroups(groups);
        return vo;
    }

    // ============ 5.3 任务详情 ============

    public TaskDetailVO detail(SecurityUser user, Long id) {
        OpsScheduleTask t = taskMapper.selectById(id);
        if (t == null || !user.getTenantId().equals(t.getTenantId()))
            throw new IllegalArgumentException("任务不存在");

        List<Long> pids = participantUserIds(id);
        boolean canView = visibilityService.canViewDetail(t, user, pids);
        boolean canOp = visibilityService.canOperate(t, user, pids);

        TaskDetailVO d = new TaskDetailVO();
        d.setTask(toVO(t, user, null, null));

        boolean masked = Boolean.TRUE.equals(t.getSensitive()) && !canView;
        if (!masked) {
            d.setContent(t.getContent());
            d.setResultSummary(t.getResultSummary());
            d.setCloseReason(t.getCloseReason());
            d.setConfirmedAt(t.getConfirmedAt());
            d.setConfirmedByName(userName(t.getConfirmedBy(), null));
            d.setStartedAt(t.getStartedAt());
            d.setCompletedByName(userName(t.getCompletedBy(), null));

            // participants
            List<OpsScheduleTaskParticipant> parts = participantMapper.selectList(
                    new LambdaQueryWrapper<OpsScheduleTaskParticipant>()
                            .eq(OpsScheduleTaskParticipant::getTaskId, id));
            d.setParticipants(parts.stream().map(p -> {
                TaskDetailVO.ParticipantVO pv = new TaskDetailVO.ParticipantVO();
                pv.setUserId(p.getUserId());
                pv.setUserName(userName(p.getUserId(), null));
                pv.setRole(p.getRole());
                return pv;
            }).collect(Collectors.toList()));

            // checklist
            List<OpsScheduleChecklistItem> items = checklistMapper.selectList(
                    new LambdaQueryWrapper<OpsScheduleChecklistItem>()
                            .eq(OpsScheduleChecklistItem::getTaskId, id)
                            .orderByAsc(OpsScheduleChecklistItem::getSortOrder));
            d.setChecklist(items.stream().map(i -> {
                TaskDetailVO.ChecklistItemVO iv = new TaskDetailVO.ChecklistItemVO();
                iv.setId(i.getId());
                iv.setTitle(i.getTitle());
                iv.setRequired(i.getRequired());
                iv.setInputType(i.getInputType());
                iv.setOptions(i.getOptions());
                iv.setValue(i.getValue());
                iv.setChecked(i.getChecked());
                iv.setSortOrder(i.getSortOrder());
                return iv;
            }).collect(Collectors.toList()));

            // links
            List<OpsScheduleTaskLink> links = linkMapper.selectList(
                    new LambdaQueryWrapper<OpsScheduleTaskLink>()
                            .eq(OpsScheduleTaskLink::getTaskId, id));
            d.setLinks(links.stream().map(l -> {
                TaskDetailVO.TaskLinkVO lv = new TaskDetailVO.TaskLinkVO();
                lv.setId(l.getId());
                lv.setLinkType(l.getLinkType());
                lv.setLinkId(l.getLinkId());
                lv.setLinkTitle(l.getLinkTitle());
                lv.setLinkUrl(l.getLinkUrl());
                return lv;
            }).collect(Collectors.toList()));

            // logs
            List<OpsScheduleTaskLog> logs = logMapper.selectList(
                    new LambdaQueryWrapper<OpsScheduleTaskLog>()
                            .eq(OpsScheduleTaskLog::getTaskId, id)
                            .orderByDesc(OpsScheduleTaskLog::getCreatedAt));
            d.setLogs(logs.stream().map(lg -> {
                TaskDetailVO.TaskLogVO gv = new TaskDetailVO.TaskLogVO();
                gv.setId(lg.getId());
                gv.setAction(lg.getAction());
                gv.setOperatorId(lg.getOperatorId());
                gv.setOperatorName(lg.getOperatorId() != null && lg.getOperatorId() != 0L
                        ? userName(lg.getOperatorId(), null) : "系统");
                gv.setContent(lg.getContent());
                gv.setCreatedAt(lg.getCreatedAt());
                return gv;
            }).collect(Collectors.toList()));
        } else {
            d.setParticipants(List.of());
            d.setChecklist(List.of());
            d.setLinks(List.of());
            d.setLogs(List.of());
        }

        // action gates
        String s = t.getStatus();
        d.setCanConfirm(canOp && "pending_confirm".equals(s));
        d.setCanStart(canOp && Set.of("not_started", "pending_confirm", "overdue").contains(s));
        d.setCanComplete(canOp && Set.of("in_progress", "overdue", "not_started").contains(s));
        d.setCanCancel(visibilityService.canCancel(t, user)
                && Set.of("pending_confirm", "not_started", "in_progress").contains(s));
        d.setCanCloseException(canOp
                && Set.of("pending_confirm", "not_started", "in_progress", "overdue").contains(s));
        d.setCanEdit((visibilityService.canCancel(t, user))
                && Set.of("pending_confirm", "not_started").contains(s));
        return d;
    }

    // ============ 5.4 创建临时任务 ============

    @Transactional
    public Long createManual(SecurityUser user, TaskCreateRequest req) {
        if (!notBlank(req.getTitle())) throw new IllegalArgumentException("标题必填");
        if (!notBlank(req.getTaskType())) throw new IllegalArgumentException("任务类型必填");

        OpsScheduleTask t = new OpsScheduleTask();
        t.setTenantId(user.getTenantId());
        t.setTitle(req.getTitle());
        t.setTaskType(req.getTaskType());
        t.setSourceType("manual");
        t.setStatus("pending_confirm");
        t.setPlannedStartAt(req.getPlannedStartAt());
        t.setDueAt(req.getDueAt());
        t.setAssigneeId(req.getAssigneeId());
        t.setGroupId(req.getGroupId() != null ? req.getGroupId() : user.getGroupId());
        t.setPriority(notBlank(req.getPriority()) ? req.getPriority() : "normal");
        t.setContent(req.getContent());
        t.setVisibility(notBlank(req.getVisibility()) ? req.getVisibility() : "private");
        t.setPublicSummary(req.getPublicSummary());
        t.setSensitive(Boolean.TRUE.equals(req.getSensitive()));
        taskMapper.insert(t);

        // participants
        addParticipant(t.getId(), user.getTenantId(), req.getAssigneeId(), "assignee");
        if (req.getParticipantIds() != null)
            req.getParticipantIds().forEach(uid -> addParticipant(t.getId(), user.getTenantId(), uid, "collaborator"));
        if (req.getRecipientIds() != null)
            req.getRecipientIds().forEach(uid -> addParticipant(t.getId(), user.getTenantId(), uid, "recipient"));
        if (req.getEscalationUserIds() != null)
            req.getEscalationUserIds().forEach(uid -> addParticipant(t.getId(), user.getTenantId(), uid, "escalation"));

        // checklist
        if (req.getChecklistItems() != null) {
            int order = 0;
            for (ChecklistItemDTO ci : req.getChecklistItems()) {
                OpsScheduleChecklistItem item = new OpsScheduleChecklistItem();
                item.setTenantId(user.getTenantId());
                item.setTaskId(t.getId());
                item.setTitle(ci.getTitle());
                item.setRequired(Boolean.TRUE.equals(ci.getRequired()));
                item.setInputType(notBlank(ci.getInputType()) ? ci.getInputType() : "checkbox");
                item.setOptions(ci.getOptions());
                item.setChecked(false);
                item.setSortOrder(ci.getSortOrder() != null ? ci.getSortOrder() : order++);
                item.setCreatedAt(LocalDateTime.now());
                item.setUpdatedAt(LocalDateTime.now());
                checklistMapper.insert(item);
            }
        }

        writeLog(t.getId(), user.getTenantId(), "create", user.getUserId(), "手动创建任务");
        writeAudit(user.getTenantId(), "create", t.getId(), user.getUserId(), "title=" + t.getTitle());

        // notify created -> assignee + recipients
        Set<Long> notifyTargets = new LinkedHashSet<>();
        if (req.getAssigneeId() != null) notifyTargets.add(req.getAssigneeId());
        if (req.getRecipientIds() != null) notifyTargets.addAll(req.getRecipientIds());
        notificationService.send(t, "created", notifyTargets);
        return t.getId();
    }

    private void addParticipant(Long taskId, String tenantId, Long userId, String role) {
        if (userId == null) return;
        // 避免重复（assignee 可能也在 participantIds 中）
        Long exist = participantMapper.selectCount(new LambdaQueryWrapper<OpsScheduleTaskParticipant>()
                .eq(OpsScheduleTaskParticipant::getTaskId, taskId)
                .eq(OpsScheduleTaskParticipant::getUserId, userId)
                .eq(OpsScheduleTaskParticipant::getRole, role));
        if (exist != null && exist > 0) return;
        OpsScheduleTaskParticipant p = new OpsScheduleTaskParticipant();
        p.setTenantId(tenantId);
        p.setTaskId(taskId);
        p.setUserId(userId);
        p.setRole(role);
        p.setCreatedAt(LocalDateTime.now());
        participantMapper.insert(p);
    }

    // ============ 5.5 编辑任务 ============

    @Transactional
    public void update(SecurityUser user, Long id, TaskUpdateRequest req) {
        OpsScheduleTask t = loadOwned(user, id);
        if (Set.of("completed", "cancelled", "exception_closed").contains(t.getStatus()))
            throw new IllegalArgumentException("当前状态不可编辑");
        if (!d_canEdit(t, user))
            throw new IllegalArgumentException("无权编辑该任务");

        if (notBlank(req.getTitle())) t.setTitle(req.getTitle());
        if (req.getPlannedStartAt() != null) t.setPlannedStartAt(req.getPlannedStartAt());
        if (req.getDueAt() != null) t.setDueAt(req.getDueAt());
        if (req.getAssigneeId() != null) t.setAssigneeId(req.getAssigneeId());
        if (req.getGroupId() != null) t.setGroupId(req.getGroupId());
        if (notBlank(req.getPriority())) t.setPriority(req.getPriority());
        if (req.getContent() != null) t.setContent(req.getContent());
        if (notBlank(req.getVisibility())) t.setVisibility(req.getVisibility());
        if (req.getPublicSummary() != null) t.setPublicSummary(req.getPublicSummary());
        if (req.getSensitive() != null) t.setSensitive(req.getSensitive());
        taskMapper.updateById(t);

        // 重建协同/接收/升级人（保留 assignee）
        if (req.getParticipantIds() != null || req.getRecipientIds() != null || req.getEscalationUserIds() != null) {
            participantMapper.delete(new LambdaQueryWrapper<OpsScheduleTaskParticipant>()
                    .eq(OpsScheduleTaskParticipant::getTaskId, id)
                    .ne(OpsScheduleTaskParticipant::getRole, "assignee"));
            if (req.getParticipantIds() != null)
                req.getParticipantIds().forEach(uid -> addParticipant(id, user.getTenantId(), uid, "collaborator"));
            if (req.getRecipientIds() != null)
                req.getRecipientIds().forEach(uid -> addParticipant(id, user.getTenantId(), uid, "recipient"));
            if (req.getEscalationUserIds() != null)
                req.getEscalationUserIds().forEach(uid -> addParticipant(id, user.getTenantId(), uid, "escalation"));
        }

        writeLog(id, user.getTenantId(), "update", user.getUserId(), "编辑任务");
        writeAudit(user.getTenantId(), "update", id, user.getUserId(), null);
    }

    private boolean d_canEdit(OpsScheduleTask t, SecurityUser user) {
        return visibilityService.canCancel(t, user); // 创建者/组长/管理员
    }

    private OpsScheduleTask loadOwned(SecurityUser user, Long id) {
        OpsScheduleTask t = taskMapper.selectById(id);
        if (t == null || !user.getTenantId().equals(t.getTenantId()))
            throw new IllegalArgumentException("任务不存在");
        return t;
    }

    // ============ 5.6 状态操作 ============

    private void requireOperate(SecurityUser user, OpsScheduleTask t) {
        if (!visibilityService.canOperate(t, user, participantUserIds(t.getId())))
            throw new IllegalArgumentException("无权操作该任务");
    }

    @Transactional
    public void confirm(SecurityUser user, Long id) {
        OpsScheduleTask t = loadOwned(user, id);
        requireOperate(user, t);
        if (!"pending_confirm".equals(t.getStatus()))
            throw new IllegalArgumentException("仅待确认任务可确认");
        t.setStatus("not_started");
        t.setConfirmedAt(LocalDateTime.now());
        t.setConfirmedBy(user.getUserId());
        taskMapper.updateById(t);
        writeLog(id, user.getTenantId(), "confirm", user.getUserId(), "确认收到");
        writeAudit(user.getTenantId(), "confirm", id, user.getUserId(), null);
    }

    @Transactional
    public void start(SecurityUser user, Long id) {
        OpsScheduleTask t = loadOwned(user, id);
        requireOperate(user, t);
        if (!Set.of("not_started", "pending_confirm", "overdue").contains(t.getStatus()))
            throw new IllegalArgumentException("当前状态不可开始");
        if ("pending_confirm".equals(t.getStatus()) && t.getConfirmedAt() == null) {
            t.setConfirmedAt(LocalDateTime.now());
            t.setConfirmedBy(user.getUserId());
        }
        t.setStatus("in_progress");
        t.setStartedAt(LocalDateTime.now());
        taskMapper.updateById(t);
        writeLog(id, user.getTenantId(), "start", user.getUserId(), "开始执行");
        writeAudit(user.getTenantId(), "start", id, user.getUserId(), null);
    }

    @Transactional
    public void complete(SecurityUser user, Long id, TaskCompleteRequest req) {
        OpsScheduleTask t = loadOwned(user, id);
        requireOperate(user, t);
        if (!Set.of("in_progress", "overdue", "not_started").contains(t.getStatus()))
            throw new IllegalArgumentException("当前状态不可完成");
        if (!notBlank(req.getResultStatus())) throw new IllegalArgumentException("执行结论必填");
        if (Set.of("abnormal", "partial").contains(req.getResultStatus()) && !notBlank(req.getResultSummary()))
            throw new IllegalArgumentException("异常或部分完成时结果说明必填");

        // 必填检查项校验 + 更新检查项值
        List<OpsScheduleChecklistItem> items = checklistMapper.selectList(
                new LambdaQueryWrapper<OpsScheduleChecklistItem>().eq(OpsScheduleChecklistItem::getTaskId, id));
        Map<Long, ChecklistValueDTO> valueMap = new HashMap<>();
        if (req.getChecklistValues() != null)
            req.getChecklistValues().forEach(v -> valueMap.put(v.getItemId(), v));
        for (OpsScheduleChecklistItem item : items) {
            ChecklistValueDTO v = valueMap.get(item.getId());
            boolean checked = v != null && Boolean.TRUE.equals(v.getChecked());
            String value = v != null ? v.getValue() : null;
            if (Boolean.TRUE.equals(item.getRequired()) && !checked && !notBlank(value))
                throw new IllegalArgumentException("必填检查项未完成：" + item.getTitle());
            item.setChecked(checked);
            item.setValue(value);
            item.setUpdatedAt(LocalDateTime.now());
            checklistMapper.updateById(item);
        }

        t.setStatus("completed");
        t.setResultStatus(req.getResultStatus());
        t.setResultSummary(req.getResultSummary());
        t.setRiskLevel(req.getRiskLevel());
        t.setCompletedAt(LocalDateTime.now());
        t.setCompletedBy(user.getUserId());
        taskMapper.updateById(t);

        // 重建关联（先删后建）
        rebuildLinks(id, user.getTenantId(), user.getUserId(), req);

        writeLog(id, user.getTenantId(), "complete", user.getUserId(),
                "提交完成，结论=" + req.getResultStatus());
        writeAudit(user.getTenantId(), "complete", id, user.getUserId(), "result=" + req.getResultStatus());
    }

    private void rebuildLinks(Long taskId, String tenantId, Long uid, TaskCompleteRequest req) {
        linkMapper.delete(new LambdaQueryWrapper<OpsScheduleTaskLink>()
                .eq(OpsScheduleTaskLink::getTaskId, taskId));
        addLinks(taskId, tenantId, uid, "daily_report", req.getLinkedDailyReportIds());
        addLinks(taskId, tenantId, uid, "ci_instance", req.getLinkedCiInstanceIds());
        addLinks(taskId, tenantId, uid, "prometheus_alert", req.getLinkedAlertIds());
        addLinks(taskId, tenantId, uid, "change_doc", req.getLinkedChangeDocIds());
    }

    private void addLinks(Long taskId, String tenantId, Long uid, String type, List<Long> ids) {
        if (ids == null) return;
        for (Long linkId : ids) {
            if (linkId == null) continue;
            OpsScheduleTaskLink l = new OpsScheduleTaskLink();
            l.setTenantId(tenantId);
            l.setTaskId(taskId);
            l.setLinkType(type);
            l.setLinkId(linkId);
            l.setCreatedAt(LocalDateTime.now());
            l.setCreatedBy(uid);
            linkMapper.insert(l);
        }
    }

    @Transactional
    public void closeException(SecurityUser user, Long id, TaskCloseExceptionRequest req) {
        OpsScheduleTask t = loadOwned(user, id);
        requireOperate(user, t);
        if (!Set.of("pending_confirm", "not_started", "in_progress", "overdue").contains(t.getStatus()))
            throw new IllegalArgumentException("当前状态不可异常关闭");
        if (!notBlank(req.getReason())) throw new IllegalArgumentException("异常原因必填");
        t.setStatus("exception_closed");
        t.setCloseReason(req.getReason());
        t.setRiskLevel(req.getRiskLevel());
        taskMapper.updateById(t);
        writeLog(id, user.getTenantId(), "close_exception", user.getUserId(), req.getReason());
        writeAudit(user.getTenantId(), "close_exception", id, user.getUserId(), req.getReason());
    }

    @Transactional
    public void cancel(SecurityUser user, Long id, TaskCancelRequest req) {
        OpsScheduleTask t = loadOwned(user, id);
        if (!visibilityService.canCancel(t, user)) throw new IllegalArgumentException("无权取消该任务");
        if (!Set.of("pending_confirm", "not_started", "in_progress").contains(t.getStatus()))
            throw new IllegalArgumentException("当前状态不可取消");
        t.setStatus("cancelled");
        t.setCancelledAt(LocalDateTime.now());
        t.setCancelledBy(user.getUserId());
        t.setCloseReason(req != null ? req.getReason() : null);
        taskMapper.updateById(t);
        writeLog(id, user.getTenantId(), "cancel", user.getUserId(), req != null ? req.getReason() : null);
        writeAudit(user.getTenantId(), "cancel", id, user.getUserId(), req != null ? req.getReason() : null);
    }

    // ============ 5.7 手动重发提醒 ============

    @Transactional
    public void remind(SecurityUser user, Long id) {
        OpsScheduleTask t = loadOwned(user, id);
        if (!visibilityService.canCancel(t, user) && !visibilityService.canOperate(t, user, participantUserIds(id)))
            throw new IllegalArgumentException("无权重发提醒");
        Set<Long> targets = new LinkedHashSet<>();
        if (t.getAssigneeId() != null) targets.add(t.getAssigneeId());
        participantMapper.selectList(new LambdaQueryWrapper<OpsScheduleTaskParticipant>()
                        .eq(OpsScheduleTaskParticipant::getTaskId, id)
                        .eq(OpsScheduleTaskParticipant::getRole, "recipient"))
                .forEach(p -> targets.add(p.getUserId()));
        notificationService.sendManual(t, targets);
        writeLog(id, user.getTenantId(), "notify", user.getUserId(), "手动重发提醒");
    }

    // ============ 5.8 工作台卡片 ============

    public DashboardCalendarVO dashboard(SecurityUser user) {
        LocalDate today = LocalDate.now();
        List<TaskVO> todayTasks = listTasks(user, today, today, null, null, null, null, null);
        // 未来 7 天提示
        List<TaskVO> upcoming = listTasks(user, today.plusDays(1), today.plusDays(7), null, null, null, null, null);

        DashboardCalendarVO vo = new DashboardCalendarVO();
        vo.setTodayTotal(todayTasks.size());
        vo.setPendingConfirm((int) todayTasks.stream().filter(t -> "pending_confirm".equals(t.getStatus())).count());
        vo.setOverdue((int) todayTasks.stream().filter(t -> "overdue".equals(t.getStatus())).count());

        // 排序：逾期 > 今日到期 > 待确认 > 进行中 > 其它
        Comparator<TaskVO> order = Comparator.comparingInt(t -> statusRank(t.getStatus()));
        List<DashboardCalendarVO.Item> items = todayTasks.stream()
                .sorted(order)
                .limit(8)
                .map(t -> {
                    DashboardCalendarVO.Item it = new DashboardCalendarVO.Item();
                    it.setId(t.getId());
                    it.setTitle(t.getTitle());
                    it.setTaskType(t.getTaskType());
                    it.setStatus(t.getStatus());
                    it.setDueAt(t.getDueAt());
                    it.setAssigneeName(t.getAssigneeName());
                    return it;
                }).collect(Collectors.toList());
        vo.setItems(items);

        List<DashboardCalendarVO.Hint> hints = upcoming.stream().limit(5).map(t -> {
            DashboardCalendarVO.Hint h = new DashboardCalendarVO.Hint();
            h.setDate(t.getPlannedStartAt() != null ? t.getPlannedStartAt().toLocalDate().toString()
                    : (t.getDueAt() != null ? t.getDueAt().toLocalDate().toString() : null));
            h.setTitle(t.getTitle());
            h.setTaskType(t.getTaskType());
            return h;
        }).collect(Collectors.toList());
        vo.setNextHints(hints);
        return vo;
    }

    private int statusRank(String s) {
        return switch (s) {
            case "overdue" -> 0;
            case "pending_confirm" -> 1;
            case "in_progress" -> 2;
            case "not_started" -> 3;
            default -> 4;
        };
    }
}
