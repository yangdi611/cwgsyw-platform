package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTask;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskParticipantMapper;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarVisibilityService;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class OpsCalendarVisibilityServiceTest {

    private final OpsCalendarVisibilityService service =
            new OpsCalendarVisibilityService(mock(OpsScheduleTaskParticipantMapper.class));

    @Test
    void canAccessDetail_rejectsUnrelatedCrossGroupTask() {
        OpsScheduleTask task = task(2L, "group", true, 20L, 21L);

        assertThat(service.canAccessDetail(task, groupUser(30L, 3L, "read"), List.of())).isFalse();
    }

    @Test
    void canAccessDetail_allowsRelatedOwnGroupAndTenantScopes() {
        OpsScheduleTask task = task(2L, "private", true, 20L, 21L);

        assertThat(service.canAccessDetail(task, groupUser(20L, 3L, "read"), List.of())).isTrue();
        assertThat(service.canAccessDetail(task, groupUser(21L, 3L, "read"), List.of())).isTrue();
        assertThat(service.canAccessDetail(task, groupUser(22L, 3L, "read"), List.of(22L))).isTrue();
        assertThat(service.canAccessDetail(task, groupUser(30L, 2L, "read_group"), List.of())).isTrue();
        assertThat(service.canAccessDetail(task, tenantUser(), List.of())).isTrue();
    }

    @Test
    void canAccessDetail_allowsPublicTaskAcrossGroups() {
        OpsScheduleTask task = task(2L, "public", false, 20L, 21L);

        assertThat(service.canAccessDetail(task, groupUser(30L, 3L, "read"), List.of())).isTrue();
    }

    private OpsScheduleTask task(Long groupId, String visibility, boolean sensitive,
                                 Long assigneeId, Long createdBy) {
        OpsScheduleTask task = new OpsScheduleTask();
        task.setGroupId(groupId);
        task.setVisibility(visibility);
        task.setSensitive(sensitive);
        task.setAssigneeId(assigneeId);
        task.setCreatedBy(createdBy);
        return task;
    }

    private SecurityUser groupUser(Long userId, Long groupId, String permission) {
        return new SecurityUser(userId, "user-" + userId, "", "default", groupId, "group",
                Set.of("ops_calendar:" + permission));
    }

    private SecurityUser tenantUser() {
        return new SecurityUser(1L, "admin", "", "default", null, "tenant",
                Set.of("ops_calendar:read"));
    }
}
