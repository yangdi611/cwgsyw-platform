package com.cwgsyw.platform.module.task.runtime.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.org.UserGroupMembershipMapper;
import com.cwgsyw.platform.module.task.runtime.dto.TaskActionsVO;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.entity.TaskParticipant;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskParticipantMapper;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TaskVisibilityService {
    private final TaskParticipantMapper participantMapper;
    private final UserGroupMembershipMapper membershipMapper;

    public boolean canView(TaskInstance task, SecurityUser user) {
        if (!task.getTenantId().equals(user.getTenantId())) return false;
        if (isTenantScope(user)) return true;
        if (user.getUserId().equals(task.getCreatedBy())) return true;
        if (user.getUserId().equals(task.getAssigneeId())) return true;
        if (task.getGroupId() != null && groupIds(user).contains(task.getGroupId())) return true;
        return participantMapper.selectCount(new LambdaQueryWrapper<TaskParticipant>()
            .eq(TaskParticipant::getTenantId, user.getTenantId())
            .eq(TaskParticipant::getTaskId, task.getId())
            .eq(TaskParticipant::getUserId, user.getUserId())) > 0;
    }

    public void requireView(TaskInstance task, SecurityUser user) {
        if (!canView(task, user)) throw BusinessException.forbidden("TASK_ACCESS_DENIED", "无权访问该任务");
    }

    public TaskActionsVO actions(TaskInstance task, SecurityUser user) {
        boolean executor = user.getUserId().equals(task.getAssigneeId()) || isCollaborator(task, user);
        boolean editableStatus = Set.of("not_started", "in_progress", "changes_requested").contains(task.getExecutionStatus());
        boolean terminal = Set.of("completed", "cancelled", "exception_closed").contains(task.getExecutionStatus());
        return new TaskActionsVO(
            executor && "not_started".equals(task.getExecutionStatus()) && has(user, "task:update"),
            executor && editableStatus && has(user, "task:update"),
            executor && editableStatus && has(user, "task:submit"),
            !terminal && has(user, "task:cancel"),
            !terminal && has(user, "task:reassign"),
            !terminal && has(user, "task:update"),
            executor
        );
    }

    public Set<Long> groupIds(SecurityUser user) {
        Set<Long> ids = new HashSet<>(membershipMapper.findEffectiveActiveBusinessGroupIds(user.getTenantId(), user.getUserId()));
        if (user.getGroupId() != null) ids.add(user.getGroupId());
        return ids;
    }

    public boolean isTenantScope(SecurityUser user) {
        return "tenant".equals(user.getGroupScope()) || "platform".equals(user.getGroupScope());
    }

    private boolean isCollaborator(TaskInstance task, SecurityUser user) {
        return participantMapper.selectCount(new LambdaQueryWrapper<TaskParticipant>()
            .eq(TaskParticipant::getTenantId, user.getTenantId())
            .eq(TaskParticipant::getTaskId, task.getId())
            .eq(TaskParticipant::getUserId, user.getUserId())
            .in(TaskParticipant::getRole, "assignee", "collaborator")) > 0;
    }

    private boolean has(SecurityUser user, String permission) {
        return user.getPermissions().contains(permission);
    }
}
