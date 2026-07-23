package com.cwgsyw.platform.module.calendar;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.calendar.dto.CalendarDashboardVO;
import com.cwgsyw.platform.module.calendar.dto.CalendarDayVO;
import com.cwgsyw.platform.module.calendar.dto.CalendarSummaryVO;
import com.cwgsyw.platform.module.calendar.dto.CalendarWorkItemVO;
import com.cwgsyw.platform.module.opscalendar.entity.OpsDutyRoster;
import com.cwgsyw.platform.module.opscalendar.entity.OpsHolidayCalendar;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsDutyRosterMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsHolidayCalendarMapper;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.entity.TaskParticipant;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskInstanceMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskParticipantMapper;
import com.cwgsyw.platform.module.task.runtime.service.TaskVisibilityService;
import com.cwgsyw.platform.module.task.template.entity.TaskTemplate;
import com.cwgsyw.platform.module.task.template.entity.TaskTemplateVersion;
import com.cwgsyw.platform.module.task.template.mapper.TaskTemplateMapper;
import com.cwgsyw.platform.module.task.template.mapper.TaskTemplateVersionMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CalendarQueryService {
    private static final Set<String> VIEWS = Set.of("month", "week", "list");
    private static final Set<String> SCOPES = Set.of("my", "group", "all");
    private static final Set<String> LAYERS = Set.of("tasks", "rosters", "holidays");
    private static final Set<String> COMPLETED = Set.of("completed", "cancelled", "exception_closed");
    private static final long MAX_RANGE_DAYS = 93;

    private final TaskInstanceMapper taskMapper;
    private final TaskParticipantMapper participantMapper;
    private final TaskTemplateVersionMapper templateVersionMapper;
    private final TaskTemplateMapper templateMapper;
    private final OpsDutyRosterMapper rosterMapper;
    private final OpsHolidayCalendarMapper holidayMapper;
    private final TaskVisibilityService visibilityService;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;

    public List<CalendarWorkItemVO> workItems(SecurityUser user, LocalDate from, LocalDate to,
                                               String view, String scope, Long templateId,
                                               String executionStatus, String approvalStatus,
                                               Long assigneeId, Long groupId, String include) {
        validateRange(from, to);
        if (!VIEWS.contains(view)) throw BusinessException.badRequest("CALENDAR_VIEW_INVALID", "不支持的日历视图");
        if (!SCOPES.contains(scope)) throw BusinessException.badRequest("CALENDAR_SCOPE_INVALID", "不支持的日历范围");
        if ("all".equals(scope) && !visibilityService.isTenantScope(user)) {
            throw BusinessException.forbidden("CALENDAR_SCOPE_FORBIDDEN", "无权查看全部任务");
        }
        Set<String> layers = layers(include);
        List<CalendarWorkItemVO> items = new ArrayList<>();
        if (layers.contains("tasks")) {
            items.addAll(tasks(user, from, to, scope, templateId, executionStatus, approvalStatus, assigneeId, groupId));
        }
        if (layers.contains("rosters")) items.addAll(rosters(user, from, to, scope, assigneeId, groupId));
        if (layers.contains("holidays")) items.addAll(holidays(user.getTenantId(), from, to));
        return items.stream().sorted(Comparator.comparing(CalendarWorkItemVO::startAt)
            .thenComparing(CalendarWorkItemVO::itemType).thenComparing(CalendarWorkItemVO::id)).toList();
    }

    public CalendarDayVO day(SecurityUser user, LocalDate date, String scope, Long templateId,
                              String executionStatus, String approvalStatus, Long assigneeId,
                              Long groupId, String include) {
        List<CalendarWorkItemVO> items = workItems(user, date, date, "list", scope, templateId,
            executionStatus, approvalStatus, assigneeId, groupId, include);
        return new CalendarDayVO(date, summary(items), items);
    }

    public CalendarDashboardVO dashboard(SecurityUser user, LocalDate date) {
        List<CalendarWorkItemVO> items = workItems(user, date, date, "list", "my", null,
            null, null, null, null, "tasks");
        CalendarWorkItemVO featuredTask = items.stream()
            .filter(item -> "daily_work_report".equals(item.meta().get("templateCode")))
            .findFirst().orElse(null);
        return new CalendarDashboardVO(date, summary(items), items, featuredTask);
    }

    private List<CalendarWorkItemVO> tasks(SecurityUser user, LocalDate from, LocalDate to, String scope,
                                            Long templateId, String executionStatus, String approvalStatus,
                                            Long assigneeId, Long groupId) {
        Set<Long> versionIds = templateVersionIds(user.getTenantId(), templateId);
        if (templateId != null && versionIds.isEmpty()) return List.of();
        List<TaskInstance> candidates = taskMapper.selectList(new LambdaQueryWrapper<TaskInstance>()
            .eq(TaskInstance::getTenantId, user.getTenantId())
            .in(!versionIds.isEmpty(), TaskInstance::getTemplateVersionId, versionIds)
            .eq(StringUtils.hasText(executionStatus), TaskInstance::getExecutionStatus, executionStatus)
            .eq(StringUtils.hasText(approvalStatus), TaskInstance::getApprovalStatus, approvalStatus)
            .eq(assigneeId != null, TaskInstance::getAssigneeId, assigneeId)
            .eq(groupId != null, TaskInstance::getGroupId, groupId)
            .ge(TaskInstance::getBusinessDate, from)
            .le(TaskInstance::getBusinessDate, to)
            .orderByAsc(TaskInstance::getPlannedStartAt).orderByAsc(TaskInstance::getId));
        Set<Long> myTaskIds = participantMapper.selectList(new LambdaQueryWrapper<TaskParticipant>()
            .eq(TaskParticipant::getTenantId, user.getTenantId())
            .eq(TaskParticipant::getUserId, user.getUserId())).stream()
            .map(TaskParticipant::getTaskId).collect(Collectors.toSet());
        Set<Long> groupIds = visibilityService.groupIds(user);
        List<TaskInstance> tasks = candidates.stream().filter(task -> switch (scope) {
            case "all" -> true;
            case "group" -> task.getGroupId() != null && groupIds.contains(task.getGroupId());
            default -> user.getUserId().equals(task.getAssigneeId()) || myTaskIds.contains(task.getId());
        }).toList();
        return taskItems(tasks);
    }

    private List<CalendarWorkItemVO> taskItems(List<TaskInstance> tasks) {
        if (tasks.isEmpty()) return List.of();
        Set<Long> versionIds = ids(tasks, TaskInstance::getTemplateVersionId);
        Map<Long, TaskTemplateVersion> versions = versionIds.isEmpty() ? Map.of() : byId(
            templateVersionMapper.selectBatchIds(versionIds), TaskTemplateVersion::getId);
        Set<Long> templateIds = versions.values().stream().map(TaskTemplateVersion::getTemplateId)
            .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Map<Long, TaskTemplate> templates = templateIds.isEmpty() ? Map.of() : byId(
            templateMapper.selectBatchIds(templateIds), TaskTemplate::getId);
        Set<Long> assigneeIds = ids(tasks, TaskInstance::getAssigneeId);
        Map<Long, User> users = assigneeIds.isEmpty() ? Map.of() : byId(
            userMapper.selectBatchIds(assigneeIds), User::getId);
        Set<Long> groupIds = ids(tasks, TaskInstance::getGroupId);
        Map<Long, Group> groups = groupIds.isEmpty() ? Map.of() : byId(
            groupMapper.findIncludingDeletedByIds(tasks.getFirst().getTenantId(), groupIds), Group::getId);
        LocalDateTime now = LocalDateTime.now();
        return tasks.stream().map(task -> {
            TaskTemplateVersion version = nullableGet(versions, task.getTemplateVersionId());
            TaskTemplate template = version == null ? null : nullableGet(templates, version.getTemplateId());
            User assignee = nullableGet(users, task.getAssigneeId());
            Group group = nullableGet(groups, task.getGroupId());
            LocalDateTime startAt = task.getPlannedStartAt() == null ? task.getBusinessDate().atStartOfDay() : task.getPlannedStartAt();
            LocalDateTime endAt = task.getDueAt() == null ? startAt.plusHours(1) : task.getDueAt();
            boolean overdue = Boolean.TRUE.equals(task.getOverdue()) || task.getDueAt() != null
                && task.getDueAt().isBefore(now) && !COMPLETED.contains(task.getExecutionStatus());
            Map<String, Object> meta = values(
                "templateId", template == null ? null : template.getId(),
                "templateCode", template == null ? null : template.getCode(),
                "templateName", version == null ? null : version.getNameSnapshot(),
                "priority", task.getPriority(),
                "approvalStatus", task.getApprovalStatus(),
                "assigneeId", task.getAssigneeId(),
                "assigneeName", name(assignee),
                "groupId", task.getGroupId(),
                "groupName", group == null ? null : group.getName(),
                "businessDate", task.getBusinessDate());
            return new CalendarWorkItemVO("task", "task:" + task.getId(), task.getTitle(), startAt, endAt,
                task.getExecutionStatus(), overdue, "/tasks/" + task.getId(), meta);
        }).toList();
    }

    private List<CalendarWorkItemVO> rosters(SecurityUser user, LocalDate from, LocalDate to, String scope,
                                              Long assigneeId, Long requestedGroupId) {
        Set<Long> groupIds = visibilityService.groupIds(user);
        List<OpsDutyRoster> rows = rosterMapper.selectList(new LambdaQueryWrapper<OpsDutyRoster>()
            .eq(OpsDutyRoster::getTenantId, user.getTenantId())
            .ge(OpsDutyRoster::getDutyDate, from).le(OpsDutyRoster::getDutyDate, to)
            .eq(assigneeId != null, OpsDutyRoster::getAssigneeId, assigneeId)
            .eq(requestedGroupId != null, OpsDutyRoster::getGroupId, requestedGroupId)
            .orderByAsc(OpsDutyRoster::getDutyDate).orderByAsc(OpsDutyRoster::getStartAt));
        rows = rows.stream().filter(roster -> switch (scope) {
            case "all" -> true;
            case "group" -> roster.getGroupId() != null && groupIds.contains(roster.getGroupId());
            default -> user.getUserId().equals(roster.getAssigneeId()) || user.getUserId().equals(roster.getBackupAssigneeId());
        }).toList();
        Set<Long> userIds = rows.stream()
            .flatMap(row -> java.util.stream.Stream.of(row.getAssigneeId(), row.getBackupAssigneeId()))
            .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Map<Long, User> users = userIds.isEmpty() ? Map.of() : byId(userMapper.selectBatchIds(userIds), User::getId);
        Set<Long> rosterGroupIds = ids(rows, OpsDutyRoster::getGroupId);
        Map<Long, Group> groups = rosterGroupIds.isEmpty() ? Map.of() : byId(
            groupMapper.findIncludingDeletedByIds(user.getTenantId(), rosterGroupIds), Group::getId);
        return rows.stream().map(row -> {
            LocalDateTime startAt = row.getStartAt() == null ? row.getDutyDate().atStartOfDay() : row.getStartAt();
            LocalDateTime endAt = row.getEndAt() == null ? row.getDutyDate().atTime(LocalTime.MAX) : row.getEndAt();
            User assignee = nullableGet(users, row.getAssigneeId());
            User backup = nullableGet(users, row.getBackupAssigneeId());
            Group group = nullableGet(groups, row.getGroupId());
            Map<String, Object> meta = values(
                "shiftName", row.getShiftName(),
                "assigneeId", row.getAssigneeId(),
                "assigneeName", name(assignee),
                "backupAssigneeId", row.getBackupAssigneeId(),
                "backupAssigneeName", name(backup),
                "phone", StringUtils.hasText(row.getPhoneOverride()) ? row.getPhoneOverride() : assignee == null ? null : assignee.getPhone(),
                "groupId", row.getGroupId(),
                "groupName", group == null ? null : group.getName(),
                "remark", row.getRemark());
            return new CalendarWorkItemVO("roster", "roster:" + row.getId(),
                row.getShiftName() + " · " + name(assignee), startAt, endAt, "scheduled", false,
                "/ops-calendar/rosters", meta);
        }).toList();
    }

    private List<CalendarWorkItemVO> holidays(String tenantId, LocalDate from, LocalDate to) {
        return holidayMapper.selectList(new LambdaQueryWrapper<OpsHolidayCalendar>()
            .eq(OpsHolidayCalendar::getTenantId, tenantId).eq(OpsHolidayCalendar::getEnabled, true)
            .le(OpsHolidayCalendar::getStartDate, to).ge(OpsHolidayCalendar::getEndDate, from)
            .orderByAsc(OpsHolidayCalendar::getStartDate)).stream().map(holiday ->
            new CalendarWorkItemVO("holiday", "holiday:" + holiday.getId(), holiday.getName(),
                holiday.getStartDate().atStartOfDay(), holiday.getEndDate().plusDays(1).atStartOfDay(),
                "active", false, "/ops-calendar/holidays", values(
                    "holidayType", holiday.getHolidayType(), "workdayOverrides", holiday.getWorkdayOverrides(),
                    "remark", holiday.getRemark()))).toList();
    }

    private Set<Long> templateVersionIds(String tenantId, Long templateId) {
        if (templateId == null) return Set.of();
        return templateVersionMapper.selectList(new LambdaQueryWrapper<TaskTemplateVersion>()
            .eq(TaskTemplateVersion::getTenantId, tenantId).eq(TaskTemplateVersion::getTemplateId, templateId))
            .stream().map(TaskTemplateVersion::getId).collect(Collectors.toSet());
    }

    private CalendarSummaryVO summary(List<CalendarWorkItemVO> items) {
        long completed = items.stream().filter(item -> "task".equals(item.itemType()) && COMPLETED.contains(item.status())).count();
        long overdue = items.stream().filter(CalendarWorkItemVO::overdue).count();
        long pending = items.stream().filter(item -> "task".equals(item.itemType()) && !COMPLETED.contains(item.status())).count();
        return new CalendarSummaryVO(items.size(), pending, overdue, completed);
    }

    private void validateRange(LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from)) {
            throw BusinessException.badRequest("CALENDAR_RANGE_INVALID", "日历日期范围无效");
        }
        if (ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) {
            throw BusinessException.badRequest("CALENDAR_RANGE_TOO_LARGE", "日历查询范围不能超过 94 天");
        }
    }

    private Set<String> layers(String include) {
        Set<String> values = java.util.Arrays.stream(include == null ? new String[0] : include.split(","))
            .map(String::trim).filter(LAYERS::contains).collect(Collectors.toCollection(LinkedHashSet::new));
        return values.isEmpty() ? Set.of("tasks") : Set.copyOf(values);
    }

    private <T> Set<Long> ids(Collection<T> values, Function<T, Long> getter) {
        return values.stream().map(getter).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
    }

    private <T> Map<Long, T> byId(Collection<T> values, Function<T, Long> getter) {
        return values.stream().collect(Collectors.toMap(getter, Function.identity(), (left, right) -> left, LinkedHashMap::new));
    }

    private <T> T nullableGet(Map<Long, T> values, Long id) {
        return id == null ? null : values.get(id);
    }

    private String name(User user) {
        if (user == null) return "未指定";
        return StringUtils.hasText(user.getRealName()) ? user.getRealName() : user.getUsername();
    }

    private Map<String, Object> values(Object... pairs) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index + 1 < pairs.length; index += 2) {
            if (pairs[index + 1] != null) result.put(String.valueOf(pairs[index]), pairs[index + 1]);
        }
        return Map.copyOf(result);
    }
}
