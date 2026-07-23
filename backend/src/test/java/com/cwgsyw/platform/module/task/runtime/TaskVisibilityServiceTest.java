package com.cwgsyw.platform.module.task.runtime;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.org.UserGroupMembershipMapper;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskParticipantMapper;
import com.cwgsyw.platform.module.task.runtime.service.TaskVisibilityService;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TaskVisibilityServiceTest {
    @Test
    void rejectsCrossTenantAndUnrelatedUser() {
        TaskParticipantMapper participantMapper = mock(TaskParticipantMapper.class);
        UserGroupMembershipMapper membershipMapper = mock(UserGroupMembershipMapper.class);
        TaskVisibilityService service = new TaskVisibilityService(participantMapper, membershipMapper);
        TaskInstance task = task("tenant-a", 10L, 20L);
        SecurityUser crossTenant = user(2L, "tenant-b", null, "group");
        SecurityUser unrelated = user(2L, "tenant-a", 30L, "group");
        when(membershipMapper.findEffectiveActiveBusinessGroupIds("tenant-a", 2L)).thenReturn(List.of(30L));
        when(participantMapper.selectCount(any())).thenReturn(0L);

        assertThatThrownBy(() -> service.requireView(task, crossTenant))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> org.assertj.core.api.Assertions.assertThat(((BusinessException) error).getErrorCode()).isEqualTo("TASK_ACCESS_DENIED"));
        assertThatThrownBy(() -> service.requireView(task, unrelated)).isInstanceOf(BusinessException.class);
    }

    @Test
    void creatorCanReadProgressButCannotViewSensitiveContentOrExecute() {
        TaskParticipantMapper participantMapper = mock(TaskParticipantMapper.class);
        UserGroupMembershipMapper membershipMapper = mock(UserGroupMembershipMapper.class);
        TaskVisibilityService service = new TaskVisibilityService(participantMapper, membershipMapper);
        TaskInstance task = task("tenant-a", 10L, 20L);
        task.setCreatedBy(2L);
        task.setExecutionStatus("in_progress");
        SecurityUser creator = new SecurityUser(2L, "creator", "", "tenant-a", 30L, "group",
            Set.of("task:read", "task:update", "task:submit", "task:cancel", "task:reassign"));
        when(membershipMapper.findEffectiveActiveBusinessGroupIds("tenant-a", 2L)).thenReturn(List.of(30L));
        when(participantMapper.selectCount(any())).thenReturn(0L);

        assertThat(service.canView(task, creator)).isTrue();
        assertThat(service.actions(task, creator).canViewSensitive()).isFalse();
        assertThat(service.actions(task, creator).canEditDraft()).isFalse();
        assertThat(service.actions(task, creator).canSubmit()).isFalse();
    }

    private TaskInstance task(String tenant, Long assigneeId, Long groupId) {
        TaskInstance task = new TaskInstance();
        task.setId(1L); task.setTenantId(tenant); task.setAssigneeId(assigneeId); task.setGroupId(groupId);
        return task;
    }

    private SecurityUser user(Long id, String tenant, Long groupId, String scope) {
        return new SecurityUser(id, "u" + id, "", tenant, groupId, scope, Set.of("task:read"));
    }
}
