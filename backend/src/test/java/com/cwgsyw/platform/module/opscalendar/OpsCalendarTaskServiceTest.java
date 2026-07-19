package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.opscalendar.dto.TaskCreateRequest;
import com.cwgsyw.platform.module.opscalendar.dto.TaskUpdateRequest;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTask;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTaskParticipant;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleChecklistItemMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleNotificationLogMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskLinkMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskLogMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskParticipantMapper;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarNotificationService;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarTaskService;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarVisibilityService;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OpsCalendarTaskServiceTest {

    @Mock OpsScheduleTaskMapper taskMapper;
    @Mock OpsScheduleTaskParticipantMapper participantMapper;
    @Mock OpsScheduleChecklistItemMapper checklistMapper;
    @Mock OpsScheduleTaskLogMapper logMapper;
    @Mock OpsScheduleTaskLinkMapper linkMapper;
    @Mock OpsScheduleNotificationLogMapper notificationLogMapper;
    @Mock OpsCalendarVisibilityService visibilityService;
    @Mock OpsCalendarNotificationService notificationService;
    @Mock UserMapper userMapper;
    @Mock GroupMapper groupMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;

    @InjectMocks OpsCalendarTaskService service;

    private SecurityUser groupLeader() {
        return new SecurityUser(6L, "lead_manage", "", "default", 1L, "group",
                Set.of("ops_calendar:create", "ops_calendar:complete"));
    }

    private SecurityUser platformAdmin() {
        return new SecurityUser(1L, "superadmin", "", "default", null, "platform",
                Set.of("ops_calendar:update"));
    }

    private TaskCreateRequest minimalRequest() {
        TaskCreateRequest request = new TaskCreateRequest();
        request.setTitle("未指定负责人的临时任务");
        request.setTaskType("inspection");
        request.setVisibility("private");
        return request;
    }

    @Test
    void createManual_withoutScheduleOrAssignee_defaultsStartAndMakesCreatorOperable() {
        when(taskMapper.insert(any(OpsScheduleTask.class))).thenAnswer(invocation -> {
            OpsScheduleTask task = invocation.getArgument(0);
            task.setId(101L);
            return 1;
        });
        when(participantMapper.selectCount(any())).thenReturn(0L);

        LocalDateTime before = LocalDateTime.now();
        Long taskId = service.createManual(groupLeader(), minimalRequest());
        LocalDateTime after = LocalDateTime.now();

        assertThat(taskId).isEqualTo(101L);

        ArgumentCaptor<OpsScheduleTask> taskCaptor = ArgumentCaptor.forClass(OpsScheduleTask.class);
        org.mockito.Mockito.verify(taskMapper).insert(taskCaptor.capture());
        OpsScheduleTask task = taskCaptor.getValue();
        assertThat(task.getPlannedStartAt()).isBetween(before, after);
        assertThat(task.getDueAt()).isNull();
        assertThat(task.getAssigneeId()).isNull();
        assertThat(task.getGroupId()).isEqualTo(1L);

        ArgumentCaptor<OpsScheduleTaskParticipant> participantCaptor =
                ArgumentCaptor.forClass(OpsScheduleTaskParticipant.class);
        org.mockito.Mockito.verify(participantMapper).insert(participantCaptor.capture());
        OpsScheduleTaskParticipant participant = participantCaptor.getValue();
        assertThat(participant.getTaskId()).isEqualTo(101L);
        assertThat(participant.getUserId()).isEqualTo(6L);
        assertThat(participant.getRole()).isEqualTo("collaborator");
    }

    @Test
    void createManual_creatorCanConfirmWhenAssigneeIsOmitted() {
        SecurityUser creatorUser = groupLeader();
        OpsScheduleTask created = new OpsScheduleTask();
        when(taskMapper.insert(any(OpsScheduleTask.class))).thenAnswer(invocation -> {
            OpsScheduleTask task = invocation.getArgument(0);
            task.setId(102L);
            created.setId(task.getId());
            created.setTenantId(task.getTenantId());
            created.setStatus(task.getStatus());
            return 1;
        });
        when(participantMapper.selectCount(any())).thenReturn(0L);

        service.createManual(creatorUser, minimalRequest());

        OpsScheduleTaskParticipant creator = new OpsScheduleTaskParticipant();
        creator.setTaskId(102L);
        creator.setUserId(6L);
        creator.setRole("collaborator");
        when(taskMapper.selectById(102L)).thenReturn(created);
        when(participantMapper.selectList(any())).thenReturn(List.of(creator));
        when(visibilityService.canOperate(created, creatorUser, List.of(6L))).thenReturn(true);

        service.confirm(creatorUser, 102L);

        assertThat(created.getStatus()).isEqualTo("not_started");
        assertThat(created.getConfirmedBy()).isEqualTo(6L);
        assertThat(created.getConfirmedAt()).isNotNull();
    }

    @Test
    void createManual_dueBeforeStartIsRejected() {
        TaskCreateRequest request = minimalRequest();
        request.setPlannedStartAt(LocalDateTime.of(2026, 7, 10, 10, 0));
        request.setDueAt(LocalDateTime.of(2026, 7, 10, 9, 59));

        assertThatThrownBy(() -> service.createManual(groupLeader(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("截止时间不能早于计划开始时间");
    }

    @Test
    void createManual_rejectsDatabaseUnsupportedTaskTypeAndPriorityBeforeInsert() {
        TaskCreateRequest taskTypeRequest = minimalRequest();
        taskTypeRequest.setTaskType("maintenance");
        assertThatThrownBy(() -> service.createManual(groupLeader(), taskTypeRequest))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("不支持的任务类型");

        TaskCreateRequest priorityRequest = minimalRequest();
        priorityRequest.setPriority("medium");
        assertThatThrownBy(() -> service.createManual(groupLeader(), priorityRequest))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("不支持的优先级");

        org.mockito.Mockito.verify(taskMapper, org.mockito.Mockito.never()).insert(any(OpsScheduleTask.class));
    }

    @Test
    void createManual_pastDueWithoutStartIsRejected() {
        TaskCreateRequest request = minimalRequest();
        request.setDueAt(LocalDateTime.now().minusMinutes(1));

        assertThatThrownBy(() -> service.createManual(groupLeader(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("截止时间不能早于计划开始时间");
    }

    @Test
    void assigneeCandidates_returnsEnabledTenantUsersAcrossGroups() {
        User sameGroup = candidateUser(10L, "default", 1, 1L, "同组用户");
        User crossGroup = candidateUser(11L, "default", 1, 2L, "跨组用户");
        when(userMapper.selectList(any())).thenReturn(List.of(sameGroup, crossGroup));

        var candidates = service.assigneeCandidates(groupLeader());

        assertThat(candidates).extracting("id").containsExactly(10L, 11L);
        assertThat(candidates).extracting("realName").containsExactly("同组用户", "跨组用户");
        assertThat(candidates).extracting("groupId").containsExactly(1L, 2L);
    }

    @Test
    void createManual_acceptsEnabledCrossGroupAssignee() {
        TaskCreateRequest request = minimalRequest();
        request.setAssigneeId(11L);
        when(userMapper.selectBatchIds(Set.of(11L)))
                .thenReturn(List.of(candidateUser(11L, "default", 1, 2L, "跨组用户")));
        when(taskMapper.insert(any(OpsScheduleTask.class))).thenAnswer(invocation -> {
            OpsScheduleTask task = invocation.getArgument(0);
            task.setId(109L);
            return 1;
        });
        when(participantMapper.selectCount(any())).thenReturn(0L);

        service.createManual(groupLeader(), request);

        ArgumentCaptor<OpsScheduleTask> taskCaptor = ArgumentCaptor.forClass(OpsScheduleTask.class);
        verify(taskMapper).insert(taskCaptor.capture());
        assertThat(taskCaptor.getValue().getAssigneeId()).isEqualTo(11L);
    }

    @Test
    void createManual_rejectsUnavailableTaskUserBeforeAnyWrite() {
        TaskCreateRequest request = minimalRequest();
        request.setAssigneeId(99L);
        when(userMapper.selectBatchIds(Set.of(99L)))
                .thenReturn(List.of(candidateUser(99L, "other", 1, 2L, "其他租户")));

        assertThatThrownBy(() -> service.createManual(groupLeader(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("任务人员不存在或不可用");

        verify(taskMapper, never()).insert(any(OpsScheduleTask.class));
        verify(participantMapper, never()).insert(any(OpsScheduleTaskParticipant.class));
        verify(activeGroupReferenceValidator, never()).lockAndRequire(any(), any());
    }

    @Test
    void createManual_rejectsMissingTaskUserBeforeAnyWrite() {
        TaskCreateRequest request = minimalRequest();
        request.setParticipantIds(List.of(98L));
        when(userMapper.selectBatchIds(Set.of(98L))).thenReturn(List.of());

        assertThatThrownBy(() -> service.createManual(groupLeader(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("任务人员不存在或不可用");

        verify(taskMapper, never()).insert(any(OpsScheduleTask.class));
        verify(participantMapper, never()).insert(any(OpsScheduleTaskParticipant.class));
        verify(activeGroupReferenceValidator, never()).lockAndRequire(any(), any());
    }

    @Test
    void createManual_rejectsDisabledTaskUserBeforeAnyWrite() {
        TaskCreateRequest request = minimalRequest();
        request.setRecipientIds(List.of(97L));
        when(userMapper.selectBatchIds(Set.of(97L)))
                .thenReturn(List.of(candidateUser(97L, "default", 0, 2L, "停用用户")));

        assertThatThrownBy(() -> service.createManual(groupLeader(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("任务人员不存在或不可用");

        verify(taskMapper, never()).insert(any(OpsScheduleTask.class));
        verify(participantMapper, never()).insert(any(OpsScheduleTaskParticipant.class));
        verify(activeGroupReferenceValidator, never()).lockAndRequire(any(), any());
    }

    @Test
    void createManual_validatesEffectiveGroupBeforeInsert() {
        when(taskMapper.insert(any(OpsScheduleTask.class))).thenAnswer(invocation -> {
            OpsScheduleTask task = invocation.getArgument(0);
            task.setId(103L);
            return 1;
        });
        when(participantMapper.selectCount(any())).thenReturn(0L);

        service.createManual(groupLeader(), minimalRequest());

        org.mockito.InOrder order = org.mockito.Mockito.inOrder(activeGroupReferenceValidator, taskMapper);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 1L);
        order.verify(taskMapper).insert(any(OpsScheduleTask.class));
    }

    @Test
    void createManual_accepts255CodePointTitleWithoutTruncation() {
        TaskCreateRequest request = minimalRequest();
        request.setTitle("任".repeat(255));
        when(taskMapper.insert(any(OpsScheduleTask.class))).thenAnswer(invocation -> {
            OpsScheduleTask task = invocation.getArgument(0);
            task.setId(106L);
            return 1;
        });
        when(participantMapper.selectCount(any())).thenReturn(0L);

        service.createManual(groupLeader(), request);

        ArgumentCaptor<OpsScheduleTask> taskCaptor = ArgumentCaptor.forClass(OpsScheduleTask.class);
        verify(taskMapper).insert(taskCaptor.capture());
        assertThat(taskCaptor.getValue().getTitle()).isEqualTo(request.getTitle());
    }

    @Test
    void createManual_rejects256CodePointTitleBeforeAnyWrite() {
        TaskCreateRequest request = minimalRequest();
        request.setTitle("😀".repeat(256));

        assertThatThrownBy(() -> service.createManual(groupLeader(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("标题不能超过 255 个字符");

        org.mockito.Mockito.verifyNoInteractions(taskMapper, participantMapper, checklistMapper, logMapper,
                auditLogMapper, notificationService, activeGroupReferenceValidator);
    }

    @Test
    void update_accepts255CodePointTitleWithoutTruncation() {
        OpsScheduleTask task = editableTask();
        SecurityUser user = platformAdmin();
        TaskUpdateRequest request = new TaskUpdateRequest();
        request.setTitle("更".repeat(255));
        when(taskMapper.selectById(107L)).thenReturn(task);
        when(visibilityService.canCancel(task, user)).thenReturn(true);

        service.update(user, 107L, request);

        assertThat(task.getTitle()).isEqualTo(request.getTitle());
        verify(taskMapper).updateById(task);
    }

    @Test
    void update_rejectsBlankAnd256CodePointTitlesWithoutWrites() {
        OpsScheduleTask task = editableTask();
        SecurityUser user = platformAdmin();
        when(taskMapper.selectById(107L)).thenReturn(task);
        when(visibilityService.canCancel(task, user)).thenReturn(true);

        TaskUpdateRequest blank = new TaskUpdateRequest();
        blank.setTitle("   ");
        assertThatThrownBy(() -> service.update(user, 107L, blank))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("标题必填");

        TaskUpdateRequest overlong = new TaskUpdateRequest();
        overlong.setTitle("😀".repeat(256));
        assertThatThrownBy(() -> service.update(user, 107L, overlong))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("标题不能超过 255 个字符");

        verify(taskMapper, never()).updateById(any(OpsScheduleTask.class));
        org.mockito.Mockito.verifyNoInteractions(participantMapper, logMapper, auditLogMapper,
                notificationService, activeGroupReferenceValidator);
    }

    @Test
    void update_rejectsUnavailableTaskUserBeforeAnyWrite() {
        OpsScheduleTask task = editableTask();
        SecurityUser user = platformAdmin();
        TaskUpdateRequest request = new TaskUpdateRequest();
        request.setAssigneeId(96L);
        request.setParticipantIds(List.of(95L));
        when(taskMapper.selectById(107L)).thenReturn(task);
        when(visibilityService.canCancel(task, user)).thenReturn(true);
        when(userMapper.selectBatchIds(Set.of(96L, 95L)))
                .thenReturn(List.of(candidateUser(96L, "default", 1, 2L, "有效用户")));

        assertThatThrownBy(() -> service.update(user, 107L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("任务人员不存在或不可用");

        verify(taskMapper, never()).updateById(any(OpsScheduleTask.class));
        verify(participantMapper, never()).delete(any());
        verify(participantMapper, never()).insert(any(OpsScheduleTaskParticipant.class));
        org.mockito.Mockito.verifyNoInteractions(logMapper, auditLogMapper, notificationService,
                activeGroupReferenceValidator);
    }

    @Test
    void listTasks_rejectsReversedDateRangeBeforeQuery() {
        assertThatThrownBy(() -> service.listTasks(groupLeader(),
                LocalDate.of(2026, 7, 12), LocalDate.of(2026, 7, 11),
                "all", null, null, null, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("startDate不能晚于endDate");

        org.mockito.Mockito.verifyNoInteractions(taskMapper, visibilityService);
    }

    @Test
    void detail_rejectsTaskOutsideVisibleScopeBeforeBuildingResponse() {
        OpsScheduleTask task = detailTask("group", true);
        SecurityUser user = groupLeader();
        when(taskMapper.selectById(108L)).thenReturn(task);
        when(participantMapper.selectList(any())).thenReturn(List.of());
        when(visibilityService.canAccessDetail(task, user, List.of())).thenReturn(false);

        assertThatThrownBy(() -> service.detail(user, 108L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("任务不存在");

        verify(visibilityService, never()).canViewDetail(any(), any(), any());
        verify(visibilityService, never()).canOperate(any(), any(), any());
        org.mockito.Mockito.verifyNoInteractions(checklistMapper, linkMapper, logMapper);
    }

    @Test
    void detail_masksPublicTaskWhenReaderLacksDetailPermission() {
        OpsScheduleTask task = detailTask("public", false);
        SecurityUser user = groupLeader();
        when(taskMapper.selectById(108L)).thenReturn(task);
        when(participantMapper.selectList(any())).thenReturn(List.of());
        when(visibilityService.canAccessDetail(task, user, List.of())).thenReturn(true);
        when(visibilityService.canViewDetail(task, user, List.of())).thenReturn(false);
        when(visibilityService.canOperate(task, user, List.of())).thenReturn(false);

        var detail = service.detail(user, 108L);

        assertThat(detail.getTask().getTitle()).isEqualTo("公开任务");
        assertThat(detail.getContent()).isNull();
        assertThat(detail.getParticipants()).isEmpty();
        assertThat(detail.getChecklist()).isEmpty();
        assertThat(detail.getLinks()).isEmpty();
        assertThat(detail.getLogs()).isEmpty();
    }

    @Test
    void detail_returnsFullContentForVisibleRelatedTask() {
        OpsScheduleTask task = detailTask("private", true);
        SecurityUser user = groupLeader();
        task.setCreatedBy(user.getUserId());
        when(taskMapper.selectById(108L)).thenReturn(task);
        when(participantMapper.selectList(any())).thenReturn(List.of());
        when(checklistMapper.selectList(any())).thenReturn(List.of());
        when(linkMapper.selectList(any())).thenReturn(List.of());
        when(logMapper.selectList(any())).thenReturn(List.of());
        when(visibilityService.canAccessDetail(task, user, List.of())).thenReturn(true);
        when(visibilityService.canViewDetail(task, user, List.of())).thenReturn(true);
        when(visibilityService.canOperate(task, user, List.of())).thenReturn(false);

        var detail = service.detail(user, 108L);

        assertThat(detail.getContent()).isEqualTo("完整正文");
        assertThat(detail.getParticipants()).isEmpty();
        assertThat(detail.getChecklist()).isEmpty();
        assertThat(detail.getLinks()).isEmpty();
        assertThat(detail.getLogs()).isEmpty();
    }

    @Test
    void detail_rejectsTaskOutsideCallerVisibilityBeforeDetailReads() {
        OpsScheduleTask task = editableTask();
        SecurityUser user = groupLeader();
        when(taskMapper.selectById(107L)).thenReturn(task);
        when(participantMapper.selectList(any())).thenReturn(List.of());
        when(visibilityService.canAccessDetail(task, user, List.of())).thenReturn(false);

        assertThatThrownBy(() -> service.detail(user, 107L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("任务不存在");

        verify(visibilityService, never()).canViewDetail(any(), any(), any());
        org.mockito.Mockito.verifyNoInteractions(checklistMapper, logMapper, linkMapper, userMapper, groupMapper);
    }

    @Test
    void detail_preservesAllowedTaskResponsePath() {
        OpsScheduleTask task = editableTask();
        SecurityUser user = groupLeader();
        when(taskMapper.selectById(107L)).thenReturn(task);
        when(participantMapper.selectList(any())).thenReturn(List.of());
        when(visibilityService.canAccessDetail(task, user, List.of())).thenReturn(true);
        when(visibilityService.canViewDetail(task, user, List.of())).thenReturn(true);
        when(visibilityService.canOperate(task, user, List.of())).thenReturn(false);

        var detail = service.detail(user, 107L);

        assertThat(detail.getTask().getId()).isEqualTo(107L);
        assertThat(detail.getContent()).isNull();
    }

    @Test
    void completedTask_usesTenantBoundHistoricalGroupLookup() {
        assertHistoricalTaskUsesArchivedGroup("completed");
    }

    @Test
    void exceptionClosedTask_usesTenantBoundHistoricalGroupLookup() {
        assertHistoricalTaskUsesArchivedGroup("exception_closed");
    }

    @Test
    void cancelledTask_usesTenantBoundHistoricalGroupLookup() {
        assertHistoricalTaskUsesArchivedGroup("cancelled");
    }

    @Test
    void purgeRemediationTest_rejectsNonPlatformUserBeforeLoadingTask() {
        assertThatThrownBy(() -> service.purgeRemediationTest(groupLeader(), 105L, "REM_P1_044_run"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("仅平台管理员可以清理整改测试运维任务");

        verify(taskMapper, never()).selectById(any());
    }

    @Test
    void purgeRemediationTest_rejectsBlankRunIdBeforeLoadingTask() {
        assertThatThrownBy(() -> service.purgeRemediationTest(platformAdmin(), 105L, " "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("缺少 remediationRunId");

        verify(taskMapper, never()).selectById(any());
    }

    @Test
    void purgeRemediationTest_rejectsCrossTenantTask() {
        OpsScheduleTask task = remediationTask("REM_P1_044_run");
        task.setTenantId("other");
        when(taskMapper.selectById(105L)).thenReturn(task);

        assertThatThrownBy(() -> service.purgeRemediationTest(platformAdmin(), 105L, "REM_P1_044_run"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("任务不存在");

        verify(taskMapper, never()).deleteById(any(Long.class));
    }

    @Test
    void purgeRemediationTest_rejectsTaskWithoutMatchingRunId() {
        when(taskMapper.selectById(105L)).thenReturn(remediationTask("REM_P1_044_other"));

        assertThatThrownBy(() -> service.purgeRemediationTest(platformAdmin(), 105L, "REM_P1_044_run"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("仅允许清理内容带 remediationRunId 的测试运维任务");

        verify(taskMapper, never()).deleteById(any(Long.class));
        verify(auditLogMapper, never()).insert(any(AuditLog.class));
    }

    @Test
    void purgeRemediationTest_deletesExactTaskDependenciesThenWritesAudit() {
        String runId = "REM_P1_044_run";
        when(taskMapper.selectById(105L)).thenReturn(remediationTask(runId));

        service.purgeRemediationTest(platformAdmin(), 105L, runId);

        org.mockito.InOrder order = org.mockito.Mockito.inOrder(linkMapper, checklistMapper, participantMapper,
                logMapper, notificationLogMapper, taskMapper, auditLogMapper);
        order.verify(linkMapper).delete(any());
        order.verify(checklistMapper).delete(any());
        order.verify(participantMapper).delete(any());
        order.verify(logMapper).delete(any());
        order.verify(notificationLogMapper).delete(any());
        order.verify(taskMapper).deleteById(105L);
        order.verify(auditLogMapper).insert(any(AuditLog.class));

        ArgumentCaptor<AuditLog> auditCaptor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(auditCaptor.capture());
        assertThat(auditCaptor.getValue().getTenantId()).isEqualTo("default");
        assertThat(auditCaptor.getValue().getAction()).isEqualTo("purge_remediation_test");
        assertThat(auditCaptor.getValue().getTargetId()).isEqualTo(105L);
        assertThat(auditCaptor.getValue().getOperatorId()).isEqualTo(1L);
        assertThat(auditCaptor.getValue().getRemark()).contains(runId);
    }

    private OpsScheduleTask remediationTask(String runId) {
        OpsScheduleTask task = new OpsScheduleTask();
        task.setId(105L);
        task.setTenantId("default");
        task.setTitle("整改测试运维任务");
        task.setContent("remediationRunId=" + runId);
        return task;
    }

    private OpsScheduleTask editableTask() {
        OpsScheduleTask task = new OpsScheduleTask();
        task.setId(107L);
        task.setTenantId("default");
        task.setTitle("原标题");
        task.setStatus("pending_confirm");
        task.setPriority("normal");
        task.setVisibility("private");
        return task;
    }

    private OpsScheduleTask detailTask(String visibility, boolean sensitive) {
        OpsScheduleTask task = new OpsScheduleTask();
        task.setId(108L);
        task.setTenantId("default");
        task.setTitle("公开任务");
        task.setContent("完整正文");
        task.setStatus("not_started");
        task.setVisibility(visibility);
        task.setSensitive(sensitive);
        task.setGroupId(2L);
        return task;
    }

    private User candidateUser(Long id, String tenantId, int status, Long groupId, String realName) {
        User user = new User();
        user.setId(id);
        user.setTenantId(tenantId);
        user.setStatus(status);
        user.setGroupId(groupId);
        user.setUsername("user" + id);
        user.setRealName(realName);
        return user;
    }

    private void assertHistoricalTaskUsesArchivedGroup(String status) {
        OpsScheduleTask task = new OpsScheduleTask();
        task.setId(104L);
        task.setTenantId("default");
        task.setStatus(status);
        task.setGroupId(15L);
        task.setSensitive(false);
        Group archived = new Group();
        archived.setId(15L);
        archived.setName("历史运维组");
        archived.setIsDeleted(true);
        when(visibilityService.canViewDetail(any(), any(), any())).thenReturn(true);
        when(visibilityService.canOperate(any(), any(), any())).thenReturn(false);
        when(groupMapper.findByTenantAndIdIncludingDeleted("default", 15L)).thenReturn(archived);

        var vo = service.toVO(task, groupLeader(), null, null);

        assertThat(vo.getGroupName()).isEqualTo("历史运维组");
        assertThat(vo.getGroupArchived()).isTrue();
        org.mockito.Mockito.verify(groupMapper, org.mockito.Mockito.never()).selectById(15L);
    }
}
