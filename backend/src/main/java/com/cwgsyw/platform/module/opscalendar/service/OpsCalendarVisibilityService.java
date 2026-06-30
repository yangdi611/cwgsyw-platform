package com.cwgsyw.platform.module.opscalendar.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTask;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTaskParticipant;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskParticipantMapper;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 运维日历可见性服务：决定一个用户能看到哪些任务、是否能看详情、是否能操作。
 * 见 spec 7.1 / 7.2。
 */
@Service
@RequiredArgsConstructor
public class OpsCalendarVisibilityService {

    private final OpsScheduleTaskParticipantMapper participantMapper;

    public boolean has(SecurityUser user, String action) {
        Set<String> perms = user.getPermissions();
        return perms != null && perms.contains("ops_calendar:" + action);
    }

    public boolean isAdmin(SecurityUser user) {
        String scope = user.getGroupScope();
        return "tenant".equals(scope) || "platform".equals(scope);
    }

    /** 解析有效 scope：根据请求 scope + 用户权限收敛。 */
    public String resolveScope(SecurityUser user, String requested) {
        if (requested == null || requested.isBlank()) {
            // 按角色默认：admin->all, group_leader(read_group)->group, 其余->mine
            if (isAdmin(user) || has(user, "read_all")) return "all";
            if (has(user, "read_group")) return "group";
            return "mine";
        }
        return switch (requested) {
            case "all" -> (isAdmin(user) || has(user, "read_all")) ? "all" : "mine";
            case "group" -> (isAdmin(user) || has(user, "read_group")) ? "group" : "mine";
            default -> requested; // mine / public / roster
        };
    }

    /**
     * 构建任务列表的可见性查询条件。调用方已设置好日期范围/类型/状态等过滤，
     * 这里只追加可见性相关的 where 子句。
     */
    public void applyVisibility(LambdaQueryWrapper<OpsScheduleTask> qw, SecurityUser user,
                                String scope, Long requestedGroupId) {
        switch (scope) {
            case "all" -> { /* 全部，不追加限制 */ }
            case "group" -> {
                Long gid = isAdmin(user) && requestedGroupId != null ? requestedGroupId : user.getGroupId();
                qw.eq(OpsScheduleTask::getGroupId, gid);
            }
            case "public" -> qw.eq(OpsScheduleTask::getVisibility, "public");
            case "roster", "mine" -> {
                // 我相关：负责人 / participant / 创建者 / public
                List<Long> taskIds = participantMapper.selectList(
                                new LambdaQueryWrapper<OpsScheduleTaskParticipant>()
                                        .eq(OpsScheduleTaskParticipant::getUserId, user.getUserId()))
                        .stream().map(OpsScheduleTaskParticipant::getTaskId).collect(Collectors.toList());
                Long uid = user.getUserId();
                qw.and(w -> {
                    w.eq(OpsScheduleTask::getAssigneeId, uid)
                            .or().eq(OpsScheduleTask::getCreatedBy, uid)
                            .or().eq(OpsScheduleTask::getVisibility, "public");
                    if (!taskIds.isEmpty()) w.or().in(OpsScheduleTask::getId, taskIds);
                });
            }
            default -> qw.eq(OpsScheduleTask::getAssigneeId, user.getUserId());
        }
    }

    /** 是否能看任务详情（敏感任务脱敏判断）。 */
    public boolean canViewDetail(OpsScheduleTask task, SecurityUser user, List<Long> participantUserIds) {
        if (isAdmin(user) || has(user, "read_all")) return true;
        Long uid = user.getUserId();
        boolean related = uid.equals(task.getAssigneeId())
                || uid.equals(task.getCreatedBy())
                || (participantUserIds != null && participantUserIds.contains(uid));
        if (related) return true;
        // 组长可看本组
        if (has(user, "read_group") && user.getGroupId() != null
                && user.getGroupId().equals(task.getGroupId())) return true;
        // 非敏感的 public 任务允许看脱敏后的基础字段，但详情正文不可见
        return !Boolean.TRUE.equals(task.getSensitive()) && "public".equals(task.getVisibility()) && false;
    }

    /**
     * 是否能执行（确认/开始/完成）。按 spec 7.2 仅限：负责人、协同人、管理员。
     * 组长（read_group）不得默认代替执行人闭环任务，避免越权。
     * @param operableUserIds 仅含 assignee/collaborator 角色的参与人（不含 recipient/escalation）
     */
    public boolean canOperate(OpsScheduleTask task, SecurityUser user, List<Long> operableUserIds) {
        if (isAdmin(user)) return true;
        Long uid = user.getUserId();
        if (uid.equals(task.getAssigneeId())) return true;
        return operableUserIds != null && operableUserIds.contains(uid);
    }

    /** 是否能取消（创建者/组长/管理员）。 */
    public boolean canCancel(OpsScheduleTask task, SecurityUser user) {
        if (isAdmin(user)) return true;
        if (user.getUserId().equals(task.getCreatedBy())) return true;
        return has(user, "read_group") && user.getGroupId() != null
                && user.getGroupId().equals(task.getGroupId());
    }
}
