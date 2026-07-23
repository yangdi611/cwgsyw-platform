package com.cwgsyw.platform.module.task.workitem;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.approval.dto.ApprovalTaskSummaryVO;
import com.cwgsyw.platform.module.approval.service.ApprovalTaskQueryPort;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.entity.TaskParticipant;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskInstanceMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskParticipantMapper;
import com.cwgsyw.platform.module.task.template.entity.TaskTemplateVersion;
import com.cwgsyw.platform.module.task.template.mapper.TaskTemplateVersionMapper;
import com.cwgsyw.platform.module.task.workitem.dto.WorkItemCountsVO;
import com.cwgsyw.platform.module.task.workitem.dto.WorkItemVO;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class WorkItemService {
    private static final Set<String> TABS = Set.of("execute", "approve", "initiated", "copied", "completed");
    private static final Set<String> TERMINAL = Set.of("completed", "cancelled", "exception_closed");
    private static final Set<String> EXECUTABLE = Set.of("not_started", "in_progress", "changes_requested");

    private final TaskInstanceMapper taskMapper;
    private final TaskParticipantMapper participantMapper;
    private final TaskTemplateVersionMapper templateVersionMapper;
    private final ApprovalTaskQueryPort approvalTasks;

    public PageResult<WorkItemVO> list(SecurityUser user, String tab, String keyword, Long templateId, String status,
                                       String priority, Boolean overdue, Long groupId,
                                       LocalDate from, LocalDate to, int page, int size) {
        requireRead(user);
        String selectedTab = StringUtils.hasText(tab) ? tab : "execute";
        if (!TABS.contains(selectedTab)) {
            throw BusinessException.badRequest("WORK_ITEM_TAB_INVALID", "工作项分类无效");
        }
        if ("approve".equals(selectedTab)) {
            PageResult<ApprovalTaskSummaryVO> approvals = approvalTasks.pending(user, keyword, templateId,
                status, priority, overdue, groupId, from, to, page, size);
            PageResult<WorkItemVO> result = new PageResult<>();
            result.setRecords(approvals.getRecords().stream().map(this::approvalItem).toList());
            result.setTotal(approvals.getTotal());
            result.setPage(approvals.getPage());
            result.setSize(approvals.getSize());
            return result;
        }
        int safePage = Math.max(1, page);
        int safeSize = Math.min(200, Math.max(1, size));
        LambdaQueryWrapper<TaskInstance> query = taskQuery(user, selectedTab, keyword, templateId, status, priority,
            overdue, groupId, from, to).orderByAsc(TaskInstance::getDueAt).orderByDesc(TaskInstance::getId);
        Page<TaskInstance> rows = taskMapper.selectPage(new Page<>(safePage, safeSize), query);
        PageResult<WorkItemVO> result = new PageResult<>();
        result.setRecords(rows.getRecords().stream().map(task -> taskItem(task, selectedTab)).toList());
        result.setTotal(rows.getTotal());
        result.setPage(rows.getCurrent());
        result.setSize(rows.getSize());
        return result;
    }

    public WorkItemCountsVO counts(SecurityUser user) {
        requireRead(user);
        return new WorkItemCountsVO(
            taskMapper.selectCount(taskQuery(user, "execute", null, null, null, null, null, null, null, null)),
            approvalTasks.pending(user, null, 1, 1).getTotal(),
            taskMapper.selectCount(taskQuery(user, "initiated", null, null, null, null, null, null, null, null)),
            taskMapper.selectCount(taskQuery(user, "copied", null, null, null, null, null, null, null, null)),
            taskMapper.selectCount(taskQuery(user, "completed", null, null, null, null, null, null, null, null))
        );
    }

    private LambdaQueryWrapper<TaskInstance> taskQuery(SecurityUser user, String tab, String keyword, Long templateId,
                                                        String status, String priority, Boolean overdue,
                                                        Long groupId, LocalDate from, LocalDate to) {
        LambdaQueryWrapper<TaskInstance> query = new LambdaQueryWrapper<TaskInstance>()
            .eq(TaskInstance::getTenantId, user.getTenantId())
            .eq(StringUtils.hasText(status), TaskInstance::getExecutionStatus, status)
            .eq(StringUtils.hasText(priority), TaskInstance::getPriority, priority)
            .eq(overdue != null, TaskInstance::getOverdue, overdue)
            .eq(groupId != null, TaskInstance::getGroupId, groupId)
            .in(templateId != null, TaskInstance::getTemplateVersionId, templateVersionIds(user.getTenantId(), templateId))
            .ge(from != null, TaskInstance::getBusinessDate, from)
            .le(to != null, TaskInstance::getBusinessDate, to)
            .and(StringUtils.hasText(keyword), value -> value.like(TaskInstance::getTitle, keyword)
                .or().like(TaskInstance::getDescription, keyword));
        switch (tab) {
            case "execute" -> {
                List<Long> participantTaskIds = participantTaskIds(user, Set.of("assignee", "collaborator"));
                query.in(TaskInstance::getExecutionStatus, EXECUTABLE)
                    .and(value -> {
                        value.eq(TaskInstance::getAssigneeId, user.getUserId());
                        if (!participantTaskIds.isEmpty()) value.or().in(TaskInstance::getId, participantTaskIds);
                    });
            }
            case "initiated" -> query.eq(TaskInstance::getCreatedBy, user.getUserId());
            case "copied" -> {
                List<Long> copiedIds = participantTaskIds(user, Set.of("copied"));
                if (copiedIds.isEmpty()) query.eq(TaskInstance::getId, -1L);
                else query.in(TaskInstance::getId, copiedIds);
            }
            case "completed" -> query.in(TaskInstance::getExecutionStatus, TERMINAL)
                .and(value -> {
                    List<Long> participantTaskIds = participantTaskIds(user, Set.of("assignee", "collaborator", "copied"));
                    value.eq(TaskInstance::getAssigneeId, user.getUserId())
                        .or().eq(TaskInstance::getCreatedBy, user.getUserId());
                    if (!participantTaskIds.isEmpty()) value.or().in(TaskInstance::getId, participantTaskIds);
                });
            default -> throw BusinessException.badRequest("WORK_ITEM_TAB_INVALID", "工作项分类无效");
        }
        return query;
    }

    private List<Long> templateVersionIds(String tenantId, Long templateId) {
        if (templateId == null) return List.of();
        List<Long> ids = templateVersionMapper.selectList(new LambdaQueryWrapper<TaskTemplateVersion>()
            .eq(TaskTemplateVersion::getTenantId, tenantId)
            .eq(TaskTemplateVersion::getTemplateId, templateId)).stream()
            .map(TaskTemplateVersion::getId).toList();
        return ids.isEmpty() ? List.of(-1L) : ids;
    }

    private List<Long> participantTaskIds(SecurityUser user, Set<String> roles) {
        return participantMapper.selectList(new LambdaQueryWrapper<TaskParticipant>()
            .eq(TaskParticipant::getTenantId, user.getTenantId())
            .eq(TaskParticipant::getUserId, user.getUserId())
            .in(TaskParticipant::getRole, roles)).stream().map(TaskParticipant::getTaskId).distinct().toList();
    }

    private WorkItemVO taskItem(TaskInstance task, String tab) {
        boolean overdue = Boolean.TRUE.equals(task.getOverdue()) || task.getDueAt() != null
            && task.getDueAt().isBefore(LocalDateTime.now()) && !TERMINAL.contains(task.getExecutionStatus());
        return new WorkItemVO("task", String.valueOf(task.getId()), task.getId(), null, task.getTitle(),
            "统一任务", null, task.getExecutionStatus(), task.getPriority(), task.getBusinessDate(), task.getDueAt(),
            overdue, "execute".equals(tab), "/tasks/" + task.getId());
    }

    private WorkItemVO approvalItem(ApprovalTaskSummaryVO item) {
        return new WorkItemVO("approval", item.approvalTaskId(), item.taskId(), item.approvalTaskId(),
            item.title(), "待审批 · " + item.nodeName(), item.nodeName(), "in_review", item.priority(),
            item.businessDate(), item.dueAt(), Boolean.TRUE.equals(item.overdue()), true,
            "/tasks/" + item.taskId());
    }

    private void requireRead(SecurityUser user) {
        if (!user.getPermissions().contains("work_item:read")) {
            throw BusinessException.forbidden("WORK_ITEM_READ_DENIED", "缺少工作项读取权限");
        }
    }
}
