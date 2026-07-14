package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.opscalendar.dto.TaskCreateRequest;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTask;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTaskParticipant;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleChecklistItemMapper;
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
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OpsCalendarTaskServiceTest {

    @Mock OpsScheduleTaskMapper taskMapper;
    @Mock OpsScheduleTaskParticipantMapper participantMapper;
    @Mock OpsScheduleChecklistItemMapper checklistMapper;
    @Mock OpsScheduleTaskLogMapper logMapper;
    @Mock OpsScheduleTaskLinkMapper linkMapper;
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
    void createManual_pastDueWithoutStartIsRejected() {
        TaskCreateRequest request = minimalRequest();
        request.setDueAt(LocalDateTime.now().minusMinutes(1));

        assertThatThrownBy(() -> service.createManual(groupLeader(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("截止时间不能早于计划开始时间");
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
