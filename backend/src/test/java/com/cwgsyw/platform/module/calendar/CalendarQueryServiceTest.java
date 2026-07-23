package com.cwgsyw.platform.module.calendar;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.cwgsyw.platform.common.BusinessException;
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
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CalendarQueryServiceTest {
    private static final LocalDate DATE = LocalDate.of(2026, 7, 23);

    @Mock TaskInstanceMapper taskMapper;
    @Mock TaskParticipantMapper participantMapper;
    @Mock TaskTemplateVersionMapper templateVersionMapper;
    @Mock TaskTemplateMapper templateMapper;
    @Mock OpsDutyRosterMapper rosterMapper;
    @Mock OpsHolidayCalendarMapper holidayMapper;
    @Mock TaskVisibilityService visibilityService;
    @Mock UserMapper userMapper;
    @Mock GroupMapper groupMapper;

    private CalendarQueryService service;
    private SecurityUser user;

    @BeforeEach
    void setUp() {
        initTableInfo(TaskInstance.class);
        initTableInfo(TaskParticipant.class);
        initTableInfo(TaskTemplateVersion.class);
        initTableInfo(OpsDutyRoster.class);
        initTableInfo(OpsHolidayCalendar.class);
        service = new CalendarQueryService(taskMapper, participantMapper, templateVersionMapper, templateMapper,
            rosterMapper, holidayMapper, visibilityService, userMapper, groupMapper);
        user = new SecurityUser(9L, "operator", "", "tenant-a", 3L, "group", Set.of("task:read"));
    }

    @Test
    void myGroupAndAllScopesApplyTheirOwnVisibilityRules() {
        TaskInstance mine = task(1L, 9L, 3L, "My task");
        TaskInstance participant = task(2L, 20L, 4L, "Participant task");
        TaskInstance groupTask = task(3L, 30L, 3L, "Group task");
        TaskInstance outside = task(4L, 40L, 8L, "Outside task");
        when(taskMapper.selectList(any())).thenReturn(List.of(mine, participant, groupTask, outside));
        when(participantMapper.selectList(any())).thenReturn(List.of(participant(2L)));
        when(visibilityService.groupIds(user)).thenReturn(Set.of(3L));
        when(visibilityService.isTenantScope(user)).thenReturn(false);

        assertThat(items("my")).extracting(item -> item.id()).containsExactly("task:1", "task:2");
        assertThat(items("group")).extracting(item -> item.id()).containsExactly("task:1", "task:3");
        assertThatThrownBy(() -> items("all"))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("CALENDAR_SCOPE_FORBIDDEN"));

        when(visibilityService.isTenantScope(user)).thenReturn(true);
        assertThat(items("all")).extracting(item -> item.id())
            .containsExactly("task:1", "task:2", "task:3", "task:4");
    }

    @Test
    void combinesTaskRosterAndHolidayIntoOneReadModel() {
        TaskInstance task = task(11L, 9L, 3L, "Database inspection");
        TaskTemplateVersion version = version(111L, 201L, "Daily inspection");
        TaskTemplate template = template(201L, "daily_inspection");
        User assignee = user(9L, "Operator");
        Group group = group(3L, "Database group");
        OpsDutyRoster roster = roster(21L, 9L, 3L);
        OpsHolidayCalendar holiday = holiday(31L);
        when(taskMapper.selectList(any())).thenReturn(List.of(task));
        when(participantMapper.selectList(any())).thenReturn(List.of());
        when(visibilityService.groupIds(user)).thenReturn(Set.of(3L));
        when(templateVersionMapper.selectBatchIds(Set.of(111L))).thenReturn(List.of(version));
        when(templateMapper.selectBatchIds(Set.of(201L))).thenReturn(List.of(template));
        when(userMapper.selectBatchIds(Set.of(9L))).thenReturn(List.of(assignee));
        when(groupMapper.findIncludingDeletedByIds("tenant-a", Set.of(3L))).thenReturn(List.of(group));
        when(rosterMapper.selectList(any())).thenReturn(List.of(roster));
        when(holidayMapper.selectList(any())).thenReturn(List.of(holiday));

        var result = service.workItems(user, DATE, DATE, "month", "my", null,
            null, null, null, null, "tasks,rosters,holidays");

        assertThat(result).extracting(item -> item.itemType()).containsExactly("holiday", "roster", "task");
        assertThat(result).filteredOn(item -> "task".equals(item.itemType())).singleElement().satisfies(item -> {
            assertThat(item.href()).isEqualTo("/tasks/11");
            assertThat(item.meta()).containsEntry("templateCode", "daily_inspection")
                .containsEntry("groupName", "Database group");
        });
        assertThat(result).filteredOn(item -> "roster".equals(item.itemType())).singleElement()
            .satisfies(item -> assertThat(item.href()).isEqualTo("/ops-calendar/rosters"));
        assertThat(result).filteredOn(item -> "holiday".equals(item.itemType())).singleElement()
            .satisfies(item -> assertThat(item.href()).isEqualTo("/ops-calendar/holidays"));
    }

    @Test
    void dashboardIdentifiesTodayFeaturedTask() {
        TaskInstance report = task(41L, 9L, null, "2026-07-23 Work report");
        TaskTemplateVersion version = version(141L, 241L, "Work report");
        TaskTemplate template = template(241L, "daily_work_report");
        when(taskMapper.selectList(any())).thenReturn(List.of(report));
        when(participantMapper.selectList(any())).thenReturn(List.of());
        when(visibilityService.groupIds(user)).thenReturn(Set.of(3L));
        when(templateVersionMapper.selectBatchIds(Set.of(141L))).thenReturn(List.of(version));
        when(templateMapper.selectBatchIds(Set.of(241L))).thenReturn(List.of(template));
        when(userMapper.selectBatchIds(Set.of(9L))).thenReturn(List.of(user(9L, "Operator")));

        var dashboard = service.dashboard(user, DATE);

        assertThat(dashboard.featuredTask()).isNotNull();
        assertThat(dashboard.featuredTask().id()).isEqualTo("task:41");
        assertThat(dashboard.featuredTask().href()).isEqualTo("/tasks/41");
    }

    @Test
    void dayPassesTemplateStatusAssigneeAndGroupFiltersToTheUnifiedTaskQuery() {
        when(templateVersionMapper.selectList(any())).thenReturn(List.of(version(151L, 51L, "Filtered")));
        when(taskMapper.selectList(any())).thenReturn(List.of());
        when(participantMapper.selectList(any())).thenReturn(List.of());
        when(visibilityService.groupIds(user)).thenReturn(Set.of(3L));

        service.day(user, DATE, "group", 51L, "in_progress", "in_review", 9L, 3L, "tasks");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Wrapper<TaskInstance>> query = ArgumentCaptor.forClass(Wrapper.class);
        verify(taskMapper).selectList(query.capture());
        assertThat(query.getValue().getSqlSegment()).contains(
            "template_version_id", "execution_status", "approval_status", "assignee_id", "group_id");
        verify(templateVersionMapper).selectList(any());
        verify(visibilityService).groupIds(eq(user));
    }

    @Test
    void rejectsInvalidOrOversizedRangesBeforeQuerying() {
        assertThatThrownBy(() -> service.workItems(user, DATE, DATE.minusDays(1), "month", "my",
            null, null, null, null, null, "tasks"))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("CALENDAR_RANGE_INVALID"));
        assertThatThrownBy(() -> service.workItems(user, DATE, DATE.plusDays(94), "month", "my",
            null, null, null, null, null, "tasks"))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("CALENDAR_RANGE_TOO_LARGE"));

        verifyNoInteractions(taskMapper, participantMapper, rosterMapper, holidayMapper);
    }

    @Test
    void emptyResultsDoNotIssueBatchLookups() {
        when(taskMapper.selectList(any())).thenReturn(List.of());
        when(participantMapper.selectList(any())).thenReturn(List.of());
        when(visibilityService.groupIds(user)).thenReturn(Set.of(3L));
        when(rosterMapper.selectList(any())).thenReturn(List.of());

        var result = service.workItems(user, DATE, DATE, "list", "my", null,
            null, null, null, null, "tasks,rosters");

        assertThat(result).isEmpty();
        verify(templateVersionMapper, never()).selectBatchIds(any());
        verify(templateMapper, never()).selectBatchIds(any());
        verify(userMapper, never()).selectBatchIds(any());
        verify(groupMapper, never()).findIncludingDeletedByIds(any(), any());
    }

    private List<com.cwgsyw.platform.module.calendar.dto.CalendarWorkItemVO> items(String scope) {
        return service.workItems(user, DATE, DATE, "list", scope, null,
            null, null, null, null, "tasks");
    }

    private TaskInstance task(Long id, Long assigneeId, Long groupId, String title) {
        TaskInstance task = new TaskInstance();
        task.setId(id);
        task.setTenantId("tenant-a");
        task.setTemplateVersionId(id + 100L);
        task.setTitle(title);
        task.setBusinessDate(DATE);
        task.setPlannedStartAt(DATE.atTime(9, 0).plusMinutes(id));
        task.setDueAt(DATE.atTime(18, 0));
        task.setExecutionStatus("not_started");
        task.setApprovalStatus("not_required");
        task.setPriority("normal");
        task.setAssigneeId(assigneeId);
        task.setGroupId(groupId);
        return task;
    }

    private TaskParticipant participant(Long taskId) {
        TaskParticipant participant = new TaskParticipant();
        participant.setTenantId("tenant-a");
        participant.setTaskId(taskId);
        participant.setUserId(9L);
        participant.setRole("collaborator");
        return participant;
    }

    private TaskTemplateVersion version(Long id, Long templateId, String name) {
        TaskTemplateVersion version = new TaskTemplateVersion();
        version.setId(id);
        version.setTenantId("tenant-a");
        version.setTemplateId(templateId);
        version.setNameSnapshot(name);
        return version;
    }

    private TaskTemplate template(Long id, String code) {
        TaskTemplate template = new TaskTemplate();
        template.setId(id);
        template.setCode(code);
        return template;
    }

    private User user(Long id, String name) {
        User value = new User();
        value.setId(id);
        value.setUsername(name.toLowerCase());
        value.setRealName(name);
        return value;
    }

    private Group group(Long id, String name) {
        Group group = new Group();
        group.setId(id);
        group.setName(name);
        return group;
    }

    private OpsDutyRoster roster(Long id, Long assigneeId, Long groupId) {
        OpsDutyRoster roster = new OpsDutyRoster();
        roster.setId(id);
        roster.setTenantId("tenant-a");
        roster.setDutyDate(DATE);
        roster.setStartAt(DATE.atTime(8, 0));
        roster.setEndAt(DATE.atTime(17, 0));
        roster.setShiftName("Day shift");
        roster.setAssigneeId(assigneeId);
        roster.setGroupId(groupId);
        return roster;
    }

    private OpsHolidayCalendar holiday(Long id) {
        OpsHolidayCalendar holiday = new OpsHolidayCalendar();
        holiday.setId(id);
        holiday.setTenantId("tenant-a");
        holiday.setName("Company day");
        holiday.setStartDate(DATE);
        holiday.setEndDate(DATE);
        holiday.setHolidayType("company");
        holiday.setEnabled(true);
        return holiday;
    }

    private void initTableInfo(Class<?> entityType) {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(),
            "calendarQueryServiceTest-" + entityType.getSimpleName()), entityType);
    }
}
