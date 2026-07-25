package com.cwgsyw.platform.module.approval.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.approval.dto.ApprovalActionRequest;
import com.cwgsyw.platform.module.approval.dto.ApprovalActionVO;
import com.cwgsyw.platform.module.approval.dto.ApprovalAttachmentCommentRequest;
import com.cwgsyw.platform.module.approval.dto.ApprovalDefinitionRequest;
import com.cwgsyw.platform.module.approval.dto.ApprovalFieldCommentRequest;
import com.cwgsyw.platform.module.approval.dto.ApprovalRoundVO;
import com.cwgsyw.platform.module.approval.dto.ApprovalTaskDetailVO;
import com.cwgsyw.platform.module.approval.dto.ApprovalTaskSummaryVO;
import com.cwgsyw.platform.module.approval.entity.ApprovalAction;
import com.cwgsyw.platform.module.approval.entity.ApprovalRound;
import com.cwgsyw.platform.module.approval.entity.ApprovalSchemeVersion;
import com.cwgsyw.platform.module.approval.mapper.ApprovalActionMapper;
import com.cwgsyw.platform.module.approval.mapper.ApprovalRoundMapper;
import com.cwgsyw.platform.module.approval.workflow.ApprovalWorkflowStart;
import com.cwgsyw.platform.module.approval.workflow.ApprovalWorkflowTask;
import com.cwgsyw.platform.module.approval.workflow.TaskApprovalWorkflowPort;
import com.cwgsyw.platform.module.task.notification.TaskNotificationOutbox;
import com.cwgsyw.platform.module.task.automation.TaskLifecycleEvent;
import com.cwgsyw.platform.module.task.metric.TaskMetricService;
import com.cwgsyw.platform.module.task.runtime.dto.TaskSubmissionAttachmentVO;
import com.cwgsyw.platform.module.task.runtime.entity.TaskDraft;
import com.cwgsyw.platform.module.task.runtime.entity.TaskEvent;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.entity.TaskSubmission;
import com.cwgsyw.platform.module.task.runtime.entity.TaskSubmissionAttachment;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskDraftMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskEventMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskFieldFactMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskInstanceMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskSubmissionAttachmentMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskSubmissionMapper;
import com.cwgsyw.platform.module.task.runtime.service.TaskDraftAttachmentService;
import com.cwgsyw.platform.module.task.runtime.service.TaskVisibilityService;
import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateVersionVO;
import com.cwgsyw.platform.module.task.template.form.TemplateFormRuntime;
import com.cwgsyw.platform.module.task.template.form.RepeatingTableSupport;
import com.cwgsyw.platform.module.task.template.service.TaskTemplateService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.workflow.event.WorkflowCompletedEvent;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ApprovalRuntimeService implements ApprovalApplicationPort, ApprovalTaskQueryPort {
    private static final Set<String> ACTIONS = Set.of(
        "approve", "return_for_changes", "return_previous_node", "terminate");
    private static final Set<String> COMMENT_SEVERITIES = Set.of("info", "warning", "error");

    private final ApprovalRoundMapper roundMapper;
    private final ApprovalActionMapper actionMapper;
    private final ApprovalSchemeService schemeService;
    private final TaskApprovalWorkflowPort workflowPort;
    private final TaskInstanceMapper taskMapper;
    private final TaskSubmissionMapper submissionMapper;
    private final TaskSubmissionAttachmentMapper submissionAttachmentMapper;
    private final TaskDraftMapper draftMapper;
    private final TaskFieldFactMapper factMapper;
    private final TaskEventMapper eventMapper;
    private final TaskTemplateService templateService;
    private final TemplateFormRuntime formRuntime;
    private final TaskVisibilityService visibilityService;
    private final TaskDraftAttachmentService attachmentService;
    private final TaskNotificationOutbox notificationOutbox;
    private final TaskMetricService metricService;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;
    private final AuditLogMapper auditLogMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long start(TaskInstance task, TaskSubmission submission, Long submittedBy) {
        ApprovalSchemeVersion version = schemeService.requirePublishedVersion(
            task.getTenantId(), task.getApprovalSchemeVersionId());
        int roundNumber = Math.toIntExact(roundMapper.selectCount(new LambdaQueryWrapper<ApprovalRound>()
            .eq(ApprovalRound::getTenantId, task.getTenantId())
            .eq(ApprovalRound::getTaskId, task.getId()))) + 1;
        ApprovalRound round = new ApprovalRound();
        round.setTenantId(task.getTenantId());
        round.setTaskId(task.getId());
        round.setSubmissionId(submission.getId());
        round.setSchemeVersionId(version.getId());
        round.setRoundNumber(roundNumber);
        round.setProcessDefinitionId(version.getProcessDefinitionId());
        round.setStatus("pending");
        round.setStartedBy(submittedBy);
        round.setStartedAt(LocalDateTime.now());
        roundMapper.insert(round);

        var mapping = workflowPort.start(new ApprovalWorkflowStart(task.getTenantId(), submission.getId(),
            round.getId(), version.getProcessDefinitionId(), submittedBy));
        round.setProcessInstanceId(mapping.getProcessInstanceId());
        round.setStatus("in_review");
        roundMapper.updateById(round);
        return round.getId();
    }

    @Override
    public Long findRoundId(String tenantId, Long submissionId) {
        ApprovalRound round = roundMapper.selectOne(new LambdaQueryWrapper<ApprovalRound>()
            .eq(ApprovalRound::getTenantId, tenantId)
            .eq(ApprovalRound::getSubmissionId, submissionId)
            .orderByDesc(ApprovalRound::getRoundNumber).last("LIMIT 1"));
        return round == null ? null : round.getId();
    }

    @Override
    public PageResult<ApprovalTaskSummaryVO> pending(SecurityUser user, String keyword, Long templateId,
                                                      String status, String priority, Boolean overdue,
                                                      Long groupId, java.time.LocalDate from,
                                                      java.time.LocalDate to, int page, int size) {
        requireApprovalRead(user);
        if (!hasApprovalPermissions(user)) {
            return emptyPage(page, size);
        }
        List<ApprovalTaskSummaryVO> visible = workflowPort.listPending(user).stream()
            .map(workflowTask -> summary(user, workflowTask))
            .filter(java.util.Objects::nonNull)
            .filter(item -> !StringUtils.hasText(keyword)
                || item.title().toLowerCase().contains(keyword.trim().toLowerCase())
                || item.nodeName().toLowerCase().contains(keyword.trim().toLowerCase()))
            .filter(item -> !StringUtils.hasText(status) || "in_review".equals(status))
            .filter(item -> !StringUtils.hasText(priority) || priority.equals(item.priority()))
            .filter(item -> overdue == null || overdue.equals(item.overdue()))
            .filter(item -> from == null || item.businessDate() != null && !item.businessDate().isBefore(from))
            .filter(item -> to == null || item.businessDate() != null && !item.businessDate().isAfter(to))
            .filter(item -> matchesTaskFilters(user.getTenantId(), item.taskId(), templateId, groupId))
            .toList();
        int safePage = Math.max(1, page);
        int safeSize = Math.min(200, Math.max(1, size));
        int offset = Math.min((safePage - 1) * safeSize, visible.size());
        int end = Math.min(offset + safeSize, visible.size());
        PageResult<ApprovalTaskSummaryVO> result = new PageResult<>();
        result.setRecords(visible.subList(offset, end));
        result.setTotal(visible.size());
        result.setPage(safePage);
        result.setSize(safeSize);
        return result;
    }

    @Override
    public PageResult<ApprovalTaskSummaryVO> pending(SecurityUser user, String keyword, int page, int size) {
        return pending(user, keyword, null, null, null, null, null, null, null, page, size);
    }

    private boolean matchesTaskFilters(String tenantId, Long taskId, Long templateId, Long groupId) {
        if (templateId == null && groupId == null) return true;
        TaskInstance task = taskMapper.selectOne(new LambdaQueryWrapper<TaskInstance>()
            .eq(TaskInstance::getTenantId, tenantId).eq(TaskInstance::getId, taskId));
        if (task == null || groupId != null && !groupId.equals(task.getGroupId())) return false;
        if (templateId == null) return true;
        TaskTemplateVersionVO version = templateService.getVersion(tenantId, task.getTemplateVersionId());
        return templateId.equals(version.getTemplateId());
    }

    public ApprovalTaskDetailVO detail(SecurityUser user, String approvalTaskId) {
        requireApprovalRead(user);
        ApprovalWorkflowTask workflowTask = workflowPort.requirePending(user, approvalTaskId);
        ApprovalRound round = requireCurrentRound(user.getTenantId(), workflowTask);
        TaskSubmission submission = requireSubmission(user.getTenantId(), workflowTask.submissionId());
        TaskInstance task = requireTask(user.getTenantId(), submission.getTaskId());
        requireApprovalVisibility(task, user);
        TaskTemplateVersionVO template = templateService.getVersion(user.getTenantId(), task.getTemplateVersionId());
        List<TaskFieldDefinition> visibleFields = template.getFields().stream()
            .filter(field -> formRuntime.fieldVisibleForRole(field, "approver"))
            .toList();
        Set<String> visibleKeys = visibleFields.stream().map(TaskFieldDefinition::getKey)
            .collect(java.util.stream.Collectors.toUnmodifiableSet());
        return new ApprovalTaskDetailVO(summary(task, workflowTask), toVO(round, visibleKeys), submission.getVersion(),
            visibleValues(submission.getFormData(), visibleKeys), visibleValues(submission.getComputedValues(), visibleKeys),
            visibleFields, attachments(user.getTenantId(), submission.getId()).stream()
                .filter(attachment -> canViewAttachment(visibleFields, attachment.fieldKey())).toList(),
            allowedActions(round.getTenantId(), round.getSchemeVersionId(), workflowTask.nodeKey()));
    }

    public TaskDraftAttachmentService.SubmissionAttachmentContent downloadAttachment(
            SecurityUser user, String approvalTaskId, Long attachmentId) {
        requireApprovalRead(user);
        ApprovalWorkflowTask workflowTask = workflowPort.requirePending(user, approvalTaskId);
        ApprovalRound round = requireCurrentRound(user.getTenantId(), workflowTask);
        TaskSubmission submission = requireSubmission(user.getTenantId(), workflowTask.submissionId());
        TaskInstance task = requireTask(user.getTenantId(), submission.getTaskId());
        requireApprovalVisibility(task, user);
        var metadata = attachmentService.findSubmission(user.getTenantId(), round.getSubmissionId(), attachmentId);
        TaskTemplateVersionVO template = templateService.getVersion(user.getTenantId(), task.getTemplateVersionId());
        boolean visible = canViewAttachment(template.getFields().stream()
            .filter(field -> formRuntime.fieldVisibleForRole(field, "approver")).toList(), metadata.getFieldKey());
        if (!visible) throw BusinessException.forbidden("APPROVAL_ATTACHMENT_HIDDEN", "无权读取该附件");
        TaskDraftAttachmentService.SubmissionAttachmentContent content =
            attachmentService.downloadSubmission(user.getTenantId(), round.getSubmissionId(), attachmentId);
        if (Boolean.TRUE.equals(content.sensitive())) {
            auditLogMapper.insert(AuditLog.builder().tenantId(user.getTenantId()).module("approval")
                .action("attachment_download").targetId(attachmentId).targetType("task_submission_attachment")
                .operatorId(user.getUserId()).remark("审批人下载敏感任务附件").createdAt(LocalDateTime.now()).build());
        }
        return content;
    }

    @Transactional(rollbackFor = Exception.class)
    public ApprovalRoundVO act(SecurityUser user, String approvalTaskId, ApprovalActionRequest request) {
        requireApprovalRead(user);
        String actionName = request.action();
        if (!ACTIONS.contains(actionName)) {
            throw BusinessException.badRequest("APPROVAL_ACTION_INVALID", "审批动作无效");
        }
        if (Set.of("return_for_changes", "return_previous_node", "terminate").contains(actionName)
                && !StringUtils.hasText(request.comment())) {
            throw BusinessException.badRequest("APPROVAL_COMMENT_REQUIRED", "退回或终止必须填写理由");
        }
        ApprovalWorkflowTask workflowTask = workflowPort.requirePending(user, approvalTaskId);
        ApprovalRound round = requireCurrentRound(user.getTenantId(), workflowTask);
        TaskSubmission submission = requireSubmission(user.getTenantId(), round.getSubmissionId());
        TaskInstance task = requireTask(user.getTenantId(), round.getTaskId());
        requireApprovalVisibility(task, user);
        if (!allowedActions(round.getTenantId(), round.getSchemeVersionId(), workflowTask.nodeKey()).contains(actionName)) {
            throw BusinessException.forbidden("APPROVAL_ACTION_NOT_ALLOWED", "当前审批方案不允许该动作");
        }
        validateComments(task, submission, request);
        ApprovalAction action = action(user, workflowTask, round, request);
        actionMapper.insert(action);
        Map<String, Object> variables = Map.of("approvalAction", actionName, "approvalActionId", action.getId());
        if ("return_previous_node".equals(actionName)) {
            workflowPort.returnToNode(user, workflowTask,
                previousNode(round.getTenantId(), round.getSchemeVersionId(), workflowTask.nodeKey()),
                trimmed(request.comment()), variables);
        } else {
            workflowPort.complete(user, workflowTask, "approve".equals(actionName),
                trimmed(request.comment()), variables);
        }
        return toVO(requireRound(user.getTenantId(), round.getId()), visibleKeys(task, "approver"));
    }

    public List<ApprovalRoundVO> rounds(SecurityUser user, Long taskId) {
        TaskInstance task = requireTask(user.getTenantId(), taskId);
        visibilityService.requireView(task, user);
        Set<String> visibleKeys = visibleKeys(task, visibilityService.actions(task, user).canViewSensitive()
            ? "executor" : "copied");
        return roundMapper.selectList(new LambdaQueryWrapper<ApprovalRound>()
            .eq(ApprovalRound::getTenantId, user.getTenantId())
            .eq(ApprovalRound::getTaskId, taskId)
            .orderByDesc(ApprovalRound::getRoundNumber)).stream()
            .map(round -> toVO(round, visibleKeys)).toList();
    }

    public ApprovalRoundVO round(SecurityUser user, Long roundId) {
        ApprovalRound round = requireRound(user.getTenantId(), roundId);
        TaskInstance task = requireTask(user.getTenantId(), round.getTaskId());
        visibilityService.requireView(task, user);
        return toVO(round, visibleKeys(task, visibilityService.actions(task, user).canViewSensitive()
            ? "executor" : "copied"));
    }

    public boolean canApprove(String tenantId, Long submissionId, SecurityUser user) {
        if (!tenantId.equals(user.getTenantId()) || !hasApprovalPermissions(user)) return false;
        TaskSubmission submission = submissionMapper.selectOne(new LambdaQueryWrapper<TaskSubmission>()
            .eq(TaskSubmission::getTenantId, tenantId).eq(TaskSubmission::getId, submissionId));
        if (submission == null) return false;
        TaskInstance task = taskMapper.selectOne(new LambdaQueryWrapper<TaskInstance>()
            .eq(TaskInstance::getTenantId, tenantId).eq(TaskInstance::getId, submission.getTaskId()));
        return task != null && task.getTenantId().equals(user.getTenantId());
    }

    public boolean canSubmit(String tenantId, Long submissionId, SecurityUser user) {
        if (!tenantId.equals(user.getTenantId())) return false;
        TaskSubmission submission = submissionMapper.selectOne(new LambdaQueryWrapper<TaskSubmission>()
            .eq(TaskSubmission::getTenantId, tenantId).eq(TaskSubmission::getId, submissionId));
        return submission != null && user.getUserId().equals(submission.getSubmittedBy());
    }

    public Map<String, String> summary(String tenantId, Long submissionId, SecurityUser viewer) {
        TaskSubmission submission = submissionMapper.selectOne(new LambdaQueryWrapper<TaskSubmission>()
            .eq(TaskSubmission::getTenantId, tenantId).eq(TaskSubmission::getId, submissionId));
        if (submission == null) return Map.of();
        TaskInstance task = taskMapper.selectOne(new LambdaQueryWrapper<TaskInstance>()
            .eq(TaskInstance::getTenantId, tenantId).eq(TaskInstance::getId, submission.getTaskId()));
        if (task == null || viewer == null || !task.getTenantId().equals(viewer.getTenantId())) return Map.of();
        User submitter = userMapper.selectById(submission.getSubmittedBy());
        return Map.of("title", task.getTitle(), "summary", "提交版本 V" + submission.getVersion(),
            "url", "/tasks/" + task.getId(), "submitter",
            submitter == null ? String.valueOf(submission.getSubmittedBy())
                : StringUtils.hasText(submitter.getRealName()) ? submitter.getRealName() : submitter.getUsername());
    }

    @Transactional(rollbackFor = Exception.class)
    public void onWorkflowCompleted(WorkflowCompletedEvent event) {
        ApprovalRound round = roundMapper.lockByProcessInstanceId(event.getTenantId(), event.getProcessInstanceId());
        if (round == null) throw new IllegalStateException("审批轮次不存在");
        if (round.getEndedAt() != null) return;
        TaskSubmission submission = requireSubmission(event.getTenantId(), round.getSubmissionId());
        TaskInstance task = taskMapper.lockById(event.getTenantId(), round.getTaskId());
        if (task == null) throw new IllegalStateException("审批关联任务不存在");
        ApprovalAction latest = latestAction(round.getTenantId(), round.getId());
        LocalDateTime completedAt = event.getCompletedAt() == null ? LocalDateTime.now() : event.getCompletedAt();
        if (event.isApproved()) approve(round, submission, task, completedAt);
        else if (latest != null && "terminate".equals(latest.getAction())) terminate(round, submission, task, latest, completedAt);
        else returnForChanges(round, submission, task, latest, completedAt);
    }

    private void approve(ApprovalRound round, TaskSubmission submission, TaskInstance task, LocalDateTime now) {
        round.setStatus("approved");
        round.setResult("approved");
        round.setEndedAt(now);
        roundMapper.updateById(round);
        submission.setStatus("approved");
        submission.setEffective(true);
        submissionMapper.updateById(submission);
        factMapper.deactivateTaskFacts(task.getTenantId(), task.getId(), now);
        factMapper.activateSubmissionFacts(task.getTenantId(), submission.getId(), now);
        metricService.activateSubmission(task.getTenantId(), task.getId(), submission.getId(), now);
        task.setExecutionStatus("completed");
        task.setApprovalStatus("approved");
        task.setCurrentSubmissionId(submission.getId());
        task.setCurrentApprovalRoundId(round.getId());
        task.setCompletedAt(now);
        task.setUpdatedBy(latestApprover(round));
        taskMapper.updateById(task);
        event(task, "approval_approved", latestApprover(round), Map.of("roundId", round.getId(),
            "submissionId", submission.getId()));
        notifyAssignee(task, submission, round, "approval_approved", "approved");
        eventPublisher.publishEvent(new TaskLifecycleEvent(task.getTenantId(), "submission_approved",
            task.getId(), submission.getId(), now));
        eventPublisher.publishEvent(new TaskLifecycleEvent(task.getTenantId(), "task_completed",
            task.getId(), submission.getId(), now));
    }

    private void returnForChanges(ApprovalRound round, TaskSubmission submission, TaskInstance task,
                                  ApprovalAction latest, LocalDateTime now) {
        if (latest == null || !"return_for_changes".equals(latest.getAction())) {
            throw new IllegalStateException("审批流程未记录退回动作");
        }
        round.setStatus("changes_requested");
        round.setResult("changes_requested");
        round.setEndedAt(now);
        roundMapper.updateById(round);
        submission.setStatus("changes_requested");
        submission.setEffective(false);
        submissionMapper.updateById(submission);
        factMapper.deactivateTaskFacts(task.getTenantId(), task.getId(), now);
        metricService.deactivateTask(task.getTenantId(), task.getId(), now);
        int revision = (task.getCurrentDraftRevision() == null ? 0 : task.getCurrentDraftRevision()) + 1;
        List<TaskSubmissionAttachment> frozen = submissionAttachmentMapper.selectList(
            new LambdaQueryWrapper<TaskSubmissionAttachment>()
                .eq(TaskSubmissionAttachment::getTenantId, task.getTenantId())
                .eq(TaskSubmissionAttachment::getSubmissionId, submission.getId()));
        Map<String, List<Long>> restoredAttachments = attachmentService.restoreFromSubmission(
            task.getTenantId(), task.getId(), revision, frozen);
        Map<String, Object> restoredFormData = copy(submission.getFormData());
        restoredAttachments.forEach(restoredFormData::put);
        TaskDraft draft = new TaskDraft();
        draft.setTenantId(task.getTenantId());
        draft.setTaskId(task.getId());
        draft.setRevision(revision);
        draft.setFormData(restoredFormData);
        draft.setCreatedBy(task.getAssigneeId());
        draft.setCreatedAt(now);
        draft.setUpdatedAt(now);
        draftMapper.insert(draft);
        task.setExecutionStatus("changes_requested");
        task.setApprovalStatus("changes_requested");
        task.setCurrentDraftRevision(revision);
        task.setCurrentApprovalRoundId(round.getId());
        task.setUpdatedBy(latest.getApproverId());
        taskMapper.updateById(task);
        event(task, "approval_returned", latest.getApproverId(), Map.of("roundId", round.getId(),
            "submissionId", submission.getId(), "comment", latest.getComment(), "draftRevision", revision));
        notifyAssignee(task, submission, round, "approval_returned", latest.getComment());
    }

    private void terminate(ApprovalRound round, TaskSubmission submission, TaskInstance task,
                           ApprovalAction latest, LocalDateTime now) {
        round.setStatus("terminated");
        round.setResult("terminated");
        round.setEndedAt(now);
        roundMapper.updateById(round);
        submission.setStatus("terminated");
        submission.setEffective(false);
        submissionMapper.updateById(submission);
        factMapper.deactivateTaskFacts(task.getTenantId(), task.getId(), now);
        metricService.deactivateTask(task.getTenantId(), task.getId(), now);
        task.setExecutionStatus("cancelled");
        task.setApprovalStatus("terminated");
        task.setCancelledAt(now);
        task.setCancelReason(latest.getComment());
        task.setUpdatedBy(latest.getApproverId());
        taskMapper.updateById(task);
        event(task, "approval_terminated", latest.getApproverId(), Map.of("roundId", round.getId(),
            "submissionId", submission.getId(), "comment", latest.getComment()));
        notifyAssignee(task, submission, round, "approval_terminated", latest.getComment());
    }

    private ApprovalAction action(SecurityUser user, ApprovalWorkflowTask workflowTask, ApprovalRound round,
                                  ApprovalActionRequest request) {
        ApprovalAction action = new ApprovalAction();
        action.setTenantId(user.getTenantId());
        action.setRoundId(round.getId());
        action.setSubmissionId(round.getSubmissionId());
        action.setFlowableTaskId(workflowTask.id());
        action.setNodeKey(workflowTask.nodeKey());
        action.setNodeName(workflowTask.nodeName());
        action.setAction(request.action());
        action.setApproverId(user.getUserId());
        action.setApproverSnapshot(Map.of("userId", user.getUserId(), "username", user.getUsername(),
            "groupId", user.getGroupId() == null ? "" : user.getGroupId()));
        action.setComment(trimmed(request.comment()));
        action.setFieldComments(fieldComments(request.fieldComments()));
        action.setAttachmentComments(attachmentComments(request.attachmentComments()));
        action.setCreatedAt(LocalDateTime.now());
        return action;
    }

    private void validateComments(TaskInstance task, TaskSubmission submission, ApprovalActionRequest request) {
        Set<String> fieldKeys = visibleKeys(task, "approver");
        for (ApprovalFieldCommentRequest comment : safe(request.fieldComments())) {
            if (!fieldKeys.contains(comment.fieldKey())) {
                throw BusinessException.badRequest("APPROVAL_FIELD_COMMENT_INVALID", "字段意见引用了不属于当前提交的字段");
            }
            if (!COMMENT_SEVERITIES.contains(comment.severity())) {
                throw BusinessException.badRequest("APPROVAL_FIELD_COMMENT_SEVERITY_INVALID", "字段意见严重级别无效");
            }
        }
        Set<Long> attachmentIds = submissionAttachmentMapper.selectList(
            new LambdaQueryWrapper<TaskSubmissionAttachment>()
                .eq(TaskSubmissionAttachment::getTenantId, submission.getTenantId())
                .eq(TaskSubmissionAttachment::getSubmissionId, submission.getId()))
            .stream().filter(attachment -> canViewAttachmentKeys(fieldKeys, attachment.getFieldKey()))
            .map(TaskSubmissionAttachment::getId).collect(java.util.stream.Collectors.toSet());
        for (ApprovalAttachmentCommentRequest comment : safe(request.attachmentComments())) {
            if (!attachmentIds.contains(comment.attachmentId())) {
                throw BusinessException.badRequest("APPROVAL_ATTACHMENT_COMMENT_INVALID", "附件意见引用了不属于当前提交的附件");
            }
        }
    }

    private ApprovalTaskSummaryVO summary(SecurityUser user, ApprovalWorkflowTask workflowTask) {
        ApprovalRound round = roundMapper.selectOne(new LambdaQueryWrapper<ApprovalRound>()
            .eq(ApprovalRound::getTenantId, user.getTenantId()).eq(ApprovalRound::getId, workflowTask.roundId())
            .eq(ApprovalRound::getStatus, "in_review"));
        if (round == null) return null;
        TaskInstance task = taskMapper.selectOne(new LambdaQueryWrapper<TaskInstance>()
            .eq(TaskInstance::getTenantId, user.getTenantId()).eq(TaskInstance::getId, round.getTaskId()));
        if (task == null || !task.getTenantId().equals(user.getTenantId())) return null;
        return summary(task, workflowTask);
    }

    private ApprovalTaskSummaryVO summary(TaskInstance task, ApprovalWorkflowTask workflowTask) {
        boolean overdue = Boolean.TRUE.equals(task.getOverdue()) || task.getDueAt() != null
            && task.getDueAt().isBefore(LocalDateTime.now());
        return new ApprovalTaskSummaryVO(workflowTask.id(), task.getId(), workflowTask.submissionId(),
            workflowTask.roundId(), task.getTitle(), workflowTask.nodeKey(), workflowTask.nodeName(),
            task.getPriority(), task.getBusinessDate(), task.getDueAt(), overdue, workflowTask.createdAt());
    }

    private ApprovalRound requireCurrentRound(String tenantId, ApprovalWorkflowTask workflowTask) {
        ApprovalRound round = requireRound(tenantId, workflowTask.roundId());
        if (!round.getSubmissionId().equals(workflowTask.submissionId())
                || !"in_review".equals(round.getStatus())) {
            throw new BusinessException(HttpStatus.CONFLICT, "APPROVAL_ROUND_NOT_CURRENT", "审批轮次已结束或不匹配");
        }
        return round;
    }

    private ApprovalRound requireRound(String tenantId, Long roundId) {
        ApprovalRound round = roundMapper.selectOne(new LambdaQueryWrapper<ApprovalRound>()
            .eq(ApprovalRound::getTenantId, tenantId).eq(ApprovalRound::getId, roundId));
        if (round == null) throw new BusinessException(HttpStatus.NOT_FOUND, "APPROVAL_ROUND_NOT_FOUND", "审批轮次不存在");
        return round;
    }

    private TaskSubmission requireSubmission(String tenantId, Long submissionId) {
        TaskSubmission submission = submissionMapper.selectOne(new LambdaQueryWrapper<TaskSubmission>()
            .eq(TaskSubmission::getTenantId, tenantId).eq(TaskSubmission::getId, submissionId));
        if (submission == null) throw new BusinessException(HttpStatus.NOT_FOUND, "TASK_SUBMISSION_NOT_FOUND", "任务提交不存在");
        return submission;
    }

    private TaskInstance requireTask(String tenantId, Long taskId) {
        TaskInstance task = taskMapper.selectOne(new LambdaQueryWrapper<TaskInstance>()
            .eq(TaskInstance::getTenantId, tenantId).eq(TaskInstance::getId, taskId));
        if (task == null) throw new BusinessException(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND", "任务不存在");
        return task;
    }

    private ApprovalAction latestAction(String tenantId, Long roundId) {
        return actionMapper.selectOne(new LambdaQueryWrapper<ApprovalAction>()
            .eq(ApprovalAction::getTenantId, tenantId).eq(ApprovalAction::getRoundId, roundId)
            .orderByDesc(ApprovalAction::getCreatedAt).orderByDesc(ApprovalAction::getId).last("LIMIT 1"));
    }

    private Long latestApprover(ApprovalRound round) {
        ApprovalAction latest = latestAction(round.getTenantId(), round.getId());
        return latest == null ? round.getStartedBy() : latest.getApproverId();
    }

    private ApprovalRoundVO toVO(ApprovalRound round) {
        List<ApprovalActionVO> actions = actionMapper.selectList(new LambdaQueryWrapper<ApprovalAction>()
            .eq(ApprovalAction::getTenantId, round.getTenantId()).eq(ApprovalAction::getRoundId, round.getId())
            .orderByAsc(ApprovalAction::getCreatedAt).orderByAsc(ApprovalAction::getId)).stream()
            .map(this::toVO).toList();
        return new ApprovalRoundVO(round.getId(), round.getTaskId(), round.getSubmissionId(),
            round.getSchemeVersionId(), round.getRoundNumber(), round.getProcessInstanceId(),
            round.getProcessDefinitionId(), round.getStatus(), round.getResult(), round.getStartedBy(),
            round.getStartedAt(), round.getEndedAt(), actions);
    }

    private ApprovalRoundVO toVO(ApprovalRound round, Set<String> visibleKeys) {
        ApprovalRoundVO value = toVO(round);
        Set<Long> visibleAttachmentIds = submissionAttachmentMapper.selectList(
            new LambdaQueryWrapper<TaskSubmissionAttachment>()
                .eq(TaskSubmissionAttachment::getTenantId, round.getTenantId())
                .eq(TaskSubmissionAttachment::getSubmissionId, round.getSubmissionId()))
            .stream().filter(attachment -> canViewAttachmentKeys(visibleKeys, attachment.getFieldKey()))
            .map(TaskSubmissionAttachment::getId)
            .collect(java.util.stream.Collectors.toUnmodifiableSet());
        List<ApprovalActionVO> actions = value.actions().stream().map(action -> new ApprovalActionVO(
            action.id(), action.flowableTaskId(), action.nodeKey(), action.nodeName(), action.action(),
            action.approverId(), action.approverSnapshot(), action.comment(),
            action.fieldComments().stream()
                .filter(comment -> visibleKeys.contains(String.valueOf(comment.get("fieldKey")))).toList(),
            action.attachmentComments().stream()
                .filter(comment -> visibleAttachmentIds.contains(longValue(comment.get("attachmentId")))).toList(),
            action.createdAt())).toList();
        return new ApprovalRoundVO(value.id(), value.taskId(), value.submissionId(), value.schemeVersionId(),
            value.roundNumber(), value.processInstanceId(), value.processDefinitionId(), value.status(), value.result(),
            value.startedBy(), value.startedAt(), value.endedAt(), actions);
    }

    private ApprovalActionVO toVO(ApprovalAction action) {
        return new ApprovalActionVO(action.getId(), action.getFlowableTaskId(), action.getNodeKey(),
            action.getNodeName(), action.getAction(), action.getApproverId(), action.getApproverSnapshot(),
            action.getComment(), action.getFieldComments(), action.getAttachmentComments(), action.getCreatedAt());
    }

    private List<TaskSubmissionAttachmentVO> attachments(String tenantId, Long submissionId) {
        return submissionAttachmentMapper.selectList(new LambdaQueryWrapper<TaskSubmissionAttachment>()
            .eq(TaskSubmissionAttachment::getTenantId, tenantId)
            .eq(TaskSubmissionAttachment::getSubmissionId, submissionId)
            .orderByAsc(TaskSubmissionAttachment::getUploadedAt)).stream()
            .map(value -> new TaskSubmissionAttachmentVO(value.getId(), value.getFieldKey(), value.getFileName(),
                value.getFileType(), value.getSizeBytes(), value.getChecksum(), value.getSensitive(), value.getUploadedAt()))
            .toList();
    }

    private boolean canViewAttachment(List<TaskFieldDefinition> fields, String fieldKey) {
        if (fields.stream().anyMatch(field -> field.getKey().equals(fieldKey))) return true;
        return RepeatingTableSupport.parseAttachmentFieldKey(fieldKey).map(location -> fields.stream()
            .filter(field -> field.getKey().equals(location.tableKey())).filter(RepeatingTableSupport::isTable)
            .anyMatch(field -> RepeatingTableSupport.column(field, location.columnKey())
                .map(column -> RepeatingTableSupport.ATTACHMENT_TYPES.contains(RepeatingTableSupport.string(column.get("type"))))
                .orElse(false))).orElse(false);
    }

    private boolean canViewAttachmentKeys(Set<String> visibleKeys, String fieldKey) {
        return visibleKeys.contains(fieldKey) || RepeatingTableSupport.parseAttachmentFieldKey(fieldKey)
            .map(location -> visibleKeys.contains(location.tableKey())).orElse(false);
    }

    private List<String> allowedActions(String tenantId, Long schemeVersionId, String currentNodeKey) {
        ApprovalSchemeVersion version = schemeService.requirePublishedVersion(tenantId, schemeVersionId);
        ApprovalDefinitionRequest definition = objectMapper.convertValue(version.getDefinitionConfig(), ApprovalDefinitionRequest.class);
        Set<String> configured = definition.allowedActions() == null || definition.allowedActions().isEmpty()
            ? Set.of("approve", "return_for_changes", "terminate") : definition.allowedActions();
        List<String> actions = new ArrayList<>(configured.stream().filter(ACTIONS::contains).toList());
        if (nodeIndex(definition, currentNodeKey) <= 0) actions.remove("return_previous_node");
        return actions.stream().sorted().toList();
    }

    private String previousNode(String tenantId, Long schemeVersionId, String currentNodeKey) {
        ApprovalSchemeVersion version = schemeService.requirePublishedVersion(tenantId, schemeVersionId);
        ApprovalDefinitionRequest definition = objectMapper.convertValue(version.getDefinitionConfig(), ApprovalDefinitionRequest.class);
        int index = nodeIndex(definition, currentNodeKey);
        if (index <= 0) {
            throw BusinessException.badRequest("APPROVAL_PREVIOUS_NODE_UNAVAILABLE", "当前节点没有可退回的上一审批节点");
        }
        return definition.nodes().get(index - 1).key();
    }

    private int nodeIndex(ApprovalDefinitionRequest definition, String currentNodeKey) {
        if (definition.nodes() == null) return -1;
        for (int index = 0; index < definition.nodes().size(); index++) {
            if (definition.nodes().get(index).key().equals(currentNodeKey)) return index;
        }
        return -1;
    }

    private List<Map<String, Object>> fieldComments(List<ApprovalFieldCommentRequest> comments) {
        return safe(comments).stream().map(value -> Map.<String, Object>of("fieldKey", value.fieldKey(),
            "severity", value.severity(), "comment", value.comment().trim())).toList();
    }

    private List<Map<String, Object>> attachmentComments(List<ApprovalAttachmentCommentRequest> comments) {
        return safe(comments).stream().map(value -> Map.<String, Object>of("attachmentId", value.attachmentId(),
            "comment", value.comment().trim())).toList();
    }

    private <T> List<T> safe(List<T> values) {
        return values == null ? List.of() : values;
    }

    private PageResult<ApprovalTaskSummaryVO> emptyPage(int page, int size) {
        int safePage = Math.max(1, page);
        int safeSize = Math.min(200, Math.max(1, size));
        PageResult<ApprovalTaskSummaryVO> result = new PageResult<>();
        result.setRecords(List.of());
        result.setTotal(0);
        result.setPage(safePage);
        result.setSize(safeSize);
        return result;
    }

    private Map<String, Object> copy(Map<String, Object> values) {
        return values == null ? Map.of() : new LinkedHashMap<>(values);
    }

    private Map<String, Object> visibleValues(Map<String, Object> values, Set<String> visibleKeys) {
        Map<String, Object> visible = new LinkedHashMap<>();
        copy(values).forEach((key, value) -> {
            if (visibleKeys.contains(key)) visible.put(key, value);
        });
        return visible;
    }

    private Set<String> visibleKeys(TaskInstance task, String role) {
        return templateService.getVersion(task.getTenantId(), task.getTemplateVersionId()).getFields().stream()
            .filter(field -> formRuntime.fieldVisibleForRole(field, role))
            .filter(field -> !Boolean.TRUE.equals(field.getSensitive())
                || "executor".equals(role) || "approver".equals(role))
            .map(TaskFieldDefinition::getKey)
            .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    private Long longValue(Object value) {
        if (value instanceof Number number) return number.longValue();
        try {
            return value == null ? null : Long.valueOf(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String trimmed(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private void requireApprovalRead(SecurityUser user) {
        if (!user.getPermissions().contains("work_item:read")) {
            throw BusinessException.forbidden("WORK_ITEM_READ_DENIED", "缺少工作项读取权限");
        }
    }

    private void requireApprovalVisibility(TaskInstance task, SecurityUser user) {
        if (!hasApprovalPermissions(user)) {
            throw BusinessException.forbidden("APPROVAL_PERMISSION_DENIED", "缺少审批权限");
        }
        if (!task.getTenantId().equals(user.getTenantId())) {
            throw BusinessException.forbidden("APPROVAL_TASK_ACCESS_DENIED", "无权访问关联任务");
        }
    }

    private boolean hasApprovalPermissions(SecurityUser user) {
        return user.getPermissions().contains("workflow:approve")
            && user.getPermissions().contains("work_item:approve");
    }

    private void event(TaskInstance task, String type, Long operatorId, Map<String, Object> data) {
        TaskEvent event = new TaskEvent();
        event.setTenantId(task.getTenantId());
        event.setTaskId(task.getId());
        event.setEventType(type);
        event.setOperatorId(operatorId);
        event.setEventData(data);
        event.setCreatedAt(LocalDateTime.now());
        eventMapper.insert(event);
    }

    private void notifyAssignee(TaskInstance task, TaskSubmission submission, ApprovalRound round,
                                String eventType, String message) {
        if (task.getAssigneeId() == null) return;
        notificationOutbox.enqueue(task.getTenantId(), task.getId(), submission.getId(), round.getId(), eventType,
            task.getAssigneeId(), "notification", "task:" + task.getId() + ':' + eventType + ':' + round.getId(),
            Map.of("title", task.getTitle(), "message", message == null ? "" : message,
                "refType", "task", "refId", task.getId()), LocalDateTime.now());
    }
}
