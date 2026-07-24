package com.cwgsyw.platform.module.task.runtime.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.approval.service.ApprovalApplicationPort;
import com.cwgsyw.platform.module.task.notification.TaskNotificationOutbox;
import com.cwgsyw.platform.module.task.automation.TaskLifecycleEvent;
import com.cwgsyw.platform.module.task.metric.TaskMetricService;
import com.cwgsyw.platform.module.task.runtime.dto.CancelTaskRequest;
import com.cwgsyw.platform.module.task.runtime.dto.AggregateReferencePreviewVO;
import com.cwgsyw.platform.module.task.runtime.dto.CloseExceptionRequest;
import com.cwgsyw.platform.module.task.runtime.dto.CreateOneOffTaskRequest;
import com.cwgsyw.platform.module.task.runtime.dto.CreateTaskSubmissionRequest;
import com.cwgsyw.platform.module.task.runtime.dto.ReassignTaskRequest;
import com.cwgsyw.platform.module.task.runtime.dto.SaveTaskDraftRequest;
import com.cwgsyw.platform.module.task.runtime.dto.TaskActionsVO;
import com.cwgsyw.platform.module.task.runtime.dto.TaskDetailVO;
import com.cwgsyw.platform.module.task.runtime.dto.TaskDraftVO;
import com.cwgsyw.platform.module.task.runtime.dto.TaskDraftAttachmentVO;
import com.cwgsyw.platform.module.task.runtime.dto.TaskEventVO;
import com.cwgsyw.platform.module.task.runtime.dto.TaskSubmissionAttachmentVO;
import com.cwgsyw.platform.module.task.runtime.dto.TaskSubmissionResultVO;
import com.cwgsyw.platform.module.task.runtime.dto.TaskSubmissionVO;
import com.cwgsyw.platform.module.task.runtime.dto.TaskSummaryVO;
import com.cwgsyw.platform.module.task.runtime.entity.TaskDraft;
import com.cwgsyw.platform.module.task.runtime.entity.TaskDraftAttachment;
import com.cwgsyw.platform.module.task.runtime.entity.TaskEvent;
import com.cwgsyw.platform.module.task.runtime.entity.TaskFieldFact;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.entity.TaskParticipant;
import com.cwgsyw.platform.module.task.runtime.entity.TaskSubmission;
import com.cwgsyw.platform.module.task.runtime.entity.TaskSubmissionAttachment;
import com.cwgsyw.platform.module.task.runtime.entity.TaskSubmissionReference;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskDraftMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskEventMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskFieldFactMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskInstanceMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskParticipantMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskSubmissionAttachmentMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskSubmissionMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskSubmissionReferenceMapper;
import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateVersionVO;
import com.cwgsyw.platform.module.task.template.dto.TemplateValidationResult;
import com.cwgsyw.platform.module.task.template.form.TemplateFormRuntime;
import com.cwgsyw.platform.module.task.template.service.TaskTemplateService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TaskRuntimeService {
    private final TaskInstanceMapper taskMapper;
    private final TaskDraftMapper draftMapper;
    private final TaskSubmissionMapper submissionMapper;
    private final TaskSubmissionAttachmentMapper submissionAttachmentMapper;
    private final TaskSubmissionReferenceMapper submissionReferenceMapper;
    private final TaskParticipantMapper participantMapper;
    private final TaskEventMapper eventMapper;
    private final TaskFieldFactMapper fieldFactMapper;
    private final TaskTemplateService templateService;
    private final TemplateFormRuntime formRuntime;
    private final TaskVisibilityService visibilityService;
    private final TaskDraftAttachmentService attachmentService;
    private final TaskNotificationOutbox notificationOutbox;
    private final TaskMetricService metricService;
    private final TaskAggregateReferenceService aggregateReferenceService;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;
    private final ApprovalApplicationPort approvalApplication;
    private final AuditLogMapper auditLogMapper;
    private final ApplicationEventPublisher eventPublisher;

    public PageResult<TaskSummaryVO> list(SecurityUser user, String scope, String keyword,
                                          Long templateVersionId, Long planId, String executionStatus,
                                          String approvalStatus, String priority, Boolean overdue,
                                          Long assigneeId, Long groupId, LocalDate businessDateFrom,
                                          LocalDate businessDateTo, int page, int size) {
        int safePage = Math.max(1, page);
        int safeSize = Math.min(200, Math.max(1, size));
        String effectiveScope = StringUtils.hasText(scope) ? scope : "my";
        LambdaQueryWrapper<TaskInstance> query = new LambdaQueryWrapper<TaskInstance>()
            .eq(TaskInstance::getTenantId, user.getTenantId())
            .eq(templateVersionId != null, TaskInstance::getTemplateVersionId, templateVersionId)
            .eq(planId != null, TaskInstance::getPlanId, planId)
            .eq(StringUtils.hasText(executionStatus), TaskInstance::getExecutionStatus, executionStatus)
            .eq(StringUtils.hasText(approvalStatus), TaskInstance::getApprovalStatus, approvalStatus)
            .eq(StringUtils.hasText(priority), TaskInstance::getPriority, priority)
            .eq(overdue != null, TaskInstance::getOverdue, overdue)
            .eq(assigneeId != null, TaskInstance::getAssigneeId, assigneeId)
            .eq(groupId != null, TaskInstance::getGroupId, groupId)
            .ge(businessDateFrom != null, TaskInstance::getBusinessDate, businessDateFrom)
            .le(businessDateTo != null, TaskInstance::getBusinessDate, businessDateTo)
            .and(StringUtils.hasText(keyword), wrapper -> wrapper.like(TaskInstance::getTitle, keyword).or().like(TaskInstance::getDescription, keyword))
            .orderByAsc(TaskInstance::getDueAt).orderByDesc(TaskInstance::getId);
        applyScope(query, user, effectiveScope);
        Page<TaskInstance> result = taskMapper.selectPage(new Page<>(safePage, safeSize), query);
        PageResult<TaskSummaryVO> response = new PageResult<>();
        response.setRecords(result.getRecords().stream().map(task -> toSummary(task, user)).toList());
        response.setTotal(result.getTotal());
        response.setPage(result.getCurrent());
        response.setSize(result.getSize());
        return response;
    }

    public TaskDetailVO get(SecurityUser user, Long taskId) {
        TaskInstance task = requireTask(user.getTenantId(), taskId);
        visibilityService.requireView(task, user);
        TaskActionsVO actions = visibilityService.actions(task, user);
        TaskTemplateVersionVO template = templateService.getVersion(user.getTenantId(), task.getTemplateVersionId());
        VisibleFields visible = visibleFields(template, actions);
        return new TaskDetailVO(toSummary(task, user), visibleTemplate(template, visible.fields()),
            draft(task, user, visible), currentSubmission(task, visible), timeline(user, taskId), actions);
    }

    @Transactional(rollbackFor = Exception.class)
    public TaskSummaryVO start(SecurityUser user, Long taskId) {
        TaskInstance task = lockTask(user, taskId);
        requireAction(visibilityService.actions(task, user).canStart(), "TASK_START_FORBIDDEN", "当前任务不可开始");
        task.setExecutionStatus("in_progress");
        task.setStartedAt(LocalDateTime.now());
        task.setUpdatedBy(user.getUserId());
        taskMapper.updateById(task);
        event(task, "started", user.getUserId(), Map.of());
        return toSummary(task, user);
    }

    @Transactional(rollbackFor = Exception.class)
    public TaskSummaryVO cancel(SecurityUser user, Long taskId, CancelTaskRequest request) {
        TaskInstance task = lockTask(user, taskId);
        requireAction(visibilityService.actions(task, user).canCancel(), "TASK_CANCEL_FORBIDDEN", "当前任务不可取消");
        task.setExecutionStatus("cancelled");
        task.setCancelledAt(LocalDateTime.now());
        task.setCancelReason(request.reason());
        task.setUpdatedBy(user.getUserId());
        taskMapper.updateById(task);
        event(task, "cancelled", user.getUserId(), Map.of("reason", request.reason()));
        return toSummary(task, user);
    }

    @Transactional(rollbackFor = Exception.class)
    public TaskSummaryVO closeException(SecurityUser user, Long taskId, CloseExceptionRequest request) {
        TaskInstance task = lockTask(user, taskId);
        visibilityService.requireView(task, user);
        if (!user.getPermissions().contains("task:update")) throw forbidden("TASK_CLOSE_FORBIDDEN", "无权异常关闭任务");
        if (Set.of("completed", "cancelled", "exception_closed").contains(task.getExecutionStatus())) {
            throw conflict("TASK_ALREADY_TERMINAL", "任务已结束");
        }
        task.setExecutionStatus("exception_closed");
        task.setCompletedAt(LocalDateTime.now());
        task.setCancelReason(request.reason());
        task.setUpdatedBy(user.getUserId());
        taskMapper.updateById(task);
        event(task, "exception_closed", user.getUserId(), Map.of("reason", request.reason()));
        return toSummary(task, user);
    }

    @Transactional(rollbackFor = Exception.class)
    public TaskSummaryVO reassign(SecurityUser user, Long taskId, ReassignTaskRequest request) {
        TaskInstance task = lockTask(user, taskId);
        requireAction(visibilityService.actions(task, user).canReassign(), "TASK_REASSIGN_FORBIDDEN", "当前任务不可转派");
        User assignee = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getTenantId, user.getTenantId())
            .eq(User::getId, request.assigneeId()).eq(User::getIsDeleted, false).eq(User::getStatus, 1));
        if (assignee == null) throw BusinessException.badRequest("TASK_ASSIGNEE_NOT_FOUND", "新执行人不存在或已停用");
        Long previous = task.getAssigneeId();
        task.setAssigneeId(request.assigneeId());
        task.setGroupId(request.groupId() == null ? assignee.getGroupId() : request.groupId());
        task.setUpdatedBy(user.getUserId());
        taskMapper.updateById(task);
        ensureParticipant(task, request.assigneeId(), "assignee");
        event(task, "reassigned", user.getUserId(), details("previousAssigneeId", previous, "assigneeId", request.assigneeId(), "reason", request.reason()));
        notificationOutbox.enqueue(task.getTenantId(), task.getId(), null, null, "task_reassigned", request.assigneeId(),
            "notification", "task:" + task.getId() + ":reassigned:" + task.getLockVersion() + ':' + request.assigneeId(),
            Map.of("title", task.getTitle(), "refType", "task", "refId", task.getId()), LocalDateTime.now());
        return toSummary(task, user);
    }

    @Transactional(rollbackFor = Exception.class)
    public void remind(SecurityUser user, Long taskId) {
        TaskInstance task = lockTask(user, taskId);
        requireAction(visibilityService.actions(task, user).canRemind(), "TASK_REMIND_FORBIDDEN", "当前任务不可提醒");
        if (task.getAssigneeId() == null) throw BusinessException.badRequest("TASK_ASSIGNEE_EMPTY", "任务没有执行人");
        String dedupe = "task:" + task.getId() + ":manual_remind:" + LocalDate.now() + ':' + task.getAssigneeId();
        notificationOutbox.enqueue(task.getTenantId(), task.getId(), null, null, "manual_remind", task.getAssigneeId(),
            "notification", dedupe, Map.of("title", task.getTitle(), "refType", "task", "refId", task.getId()), LocalDateTime.now());
        event(task, "reminded", user.getUserId(), Map.of("recipientId", task.getAssigneeId()));
    }

    @Transactional(rollbackFor = Exception.class)
    public TaskDraftVO saveDraft(SecurityUser user, Long taskId, SaveTaskDraftRequest request) {
        TaskInstance task = lockTask(user, taskId);
        requireAction(visibilityService.actions(task, user).canEditDraft(), "TASK_DRAFT_EDIT_FORBIDDEN", "当前任务不可编辑草稿");
        int currentRevision = task.getCurrentDraftRevision() == null ? 0 : task.getCurrentDraftRevision();
        if (request.revision() != currentRevision) {
            throw conflict("TASK_DRAFT_REVISION_CONFLICT", "草稿已被更新，请刷新后重试");
        }
        int nextRevision = currentRevision + 1;
        TaskDraft draft = new TaskDraft();
        draft.setTenantId(task.getTenantId());
        draft.setTaskId(task.getId());
        draft.setRevision(nextRevision);
        draft.setFormData(new LinkedHashMap<>(request.formData()));
        draft.setCreatedBy(user.getUserId());
        draft.setCreatedAt(LocalDateTime.now());
        draft.setUpdatedAt(LocalDateTime.now());
        draftMapper.insert(draft);
        attachmentService.carryForward(task.getTenantId(), task.getId(), currentRevision, nextRevision);
        task.setCurrentDraftRevision(nextRevision);
        if ("not_started".equals(task.getExecutionStatus())) {
            task.setExecutionStatus("in_progress");
            task.setStartedAt(LocalDateTime.now());
        }
        task.setUpdatedBy(user.getUserId());
        taskMapper.updateById(task);
        event(task, "draft_saved", user.getUserId(), Map.of("revision", nextRevision));
        return toDraft(draft);
    }

    public TaskDraftVO draft(TaskInstance task, SecurityUser user) {
        visibilityService.requireView(task, user);
        TaskTemplateVersionVO template = templateService.getVersion(task.getTenantId(), task.getTemplateVersionId());
        return draft(task, user, visibleFields(template, visibilityService.actions(task, user)));
    }

    private TaskDraftVO draft(TaskInstance task, SecurityUser user, VisibleFields visible) {
        visibilityService.requireView(task, user);
        TaskDraft draft = draftMapper.findLatest(task.getTenantId(), task.getId());
        if (draft == null) return new TaskDraftVO(null, task.getId(), 0, Map.of(), List.of(), null, null);
        return new TaskDraftVO(draft.getId(), draft.getTaskId(), draft.getRevision(),
            visibleValues(draft.getFormData(), visible.keys()),
            attachmentService.list(draft.getTenantId(), draft.getTaskId(), draft.getRevision()).stream()
                .filter(attachment -> visible.keys().contains(attachment.fieldKey())).toList(),
            draft.getCreatedBy(), draft.getUpdatedAt());
    }

    @Transactional(rollbackFor = Exception.class)
    public TaskDraftAttachmentVO uploadAttachment(SecurityUser user, Long taskId, Integer revision,
                                                  String fieldKey, MultipartFile file) {
        TaskInstance task = lockTask(user, taskId);
        requireAction(visibilityService.actions(task, user).canEditDraft(), "TASK_DRAFT_EDIT_FORBIDDEN", "当前任务不可编辑草稿");
        int currentRevision = task.getCurrentDraftRevision() == null ? 0 : task.getCurrentDraftRevision();
        if (!Integer.valueOf(currentRevision).equals(revision)) {
            throw conflict("TASK_DRAFT_REVISION_CONFLICT", "草稿版本已变化，请刷新后重试");
        }
        TaskDraftAttachmentVO attachment = attachmentService.upload(task, revision, fieldKey, file, user.getUserId());
        event(task, "draft_attachment_uploaded", user.getUserId(), Map.of("attachmentId", attachment.id(), "fieldKey", fieldKey));
        return attachment;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteAttachment(SecurityUser user, Long taskId, Integer revision, Long attachmentId) {
        TaskInstance task = lockTask(user, taskId);
        requireAction(visibilityService.actions(task, user).canEditDraft(), "TASK_DRAFT_EDIT_FORBIDDEN", "当前任务不可编辑草稿");
        int currentRevision = task.getCurrentDraftRevision() == null ? 0 : task.getCurrentDraftRevision();
        if (!Integer.valueOf(currentRevision).equals(revision)) {
            throw conflict("TASK_DRAFT_REVISION_CONFLICT", "草稿版本已变化，请刷新后重试");
        }
        attachmentService.delete(task, revision, attachmentId);
        event(task, "draft_attachment_deleted", user.getUserId(), Map.of("attachmentId", attachmentId));
    }

    public TemplateValidationResult validate(SecurityUser user, Long taskId) {
        TaskInstance task = requireTask(user.getTenantId(), taskId);
        visibilityService.requireView(task, user);
        TaskDraft draft = draftMapper.findLatest(task.getTenantId(), taskId);
        if (draft == null) return TemplateValidationResult.of(List.of(new com.cwgsyw.platform.module.task.template.dto.TemplateValidationIssue(
            "TASK_DRAFT_REQUIRED", null, "draft", "请先保存草稿")));
        TaskTemplateVersionVO template = templateService.getVersion(task.getTenantId(), task.getTemplateVersionId());
        Map<String, Object> formData = withAttachments(draft, template.getFields());
        var resolved = aggregateReferenceService.resolve(user, task, template.getFields(), formData, false);
        var evaluation = formRuntime.evaluate(template.getFields(), resolved.values());
        List<com.cwgsyw.platform.module.task.template.dto.TemplateValidationIssue> issues = new ArrayList<>(evaluation.issues());
        issues.addAll(validateAttachmentReferences(task, draft, template.getFields()));
        return TemplateValidationResult.of(issues);
    }

    public List<AggregateReferencePreviewVO> aggregateReferencePreview(SecurityUser user, Long taskId) {
        TaskInstance task = requireTask(user.getTenantId(), taskId);
        visibilityService.requireView(task, user);
        TaskTemplateVersionVO template = templateService.getVersion(task.getTenantId(), task.getTemplateVersionId());
        return aggregateReferenceService.preview(user, task, template.getFields());
    }

    @Transactional(rollbackFor = Exception.class)
    public TaskSubmissionResultVO submit(SecurityUser user, Long taskId, CreateTaskSubmissionRequest request) {
        TaskInstance task = lockTask(user, taskId);
        TaskSubmission existing = submissionMapper.findByIdempotencyKey(task.getTenantId(), taskId, request.idempotencyKey());
        if (existing != null && user.getUserId().equals(existing.getSubmittedBy())) {
            return result(task, existing, approvalApplication.findRoundId(
                task.getTenantId(), existing.getId()));
        }
        requireAction(visibilityService.actions(task, user).canSubmit(), "TASK_SUBMIT_FORBIDDEN", "当前任务不可提交");
        int currentRevision = task.getCurrentDraftRevision() == null ? 0 : task.getCurrentDraftRevision();
        if (request.draftRevision() != currentRevision) throw conflict("TASK_DRAFT_REVISION_CONFLICT", "草稿版本已变化，请刷新后重试");
        TaskDraft draft = draftMapper.findLatest(task.getTenantId(), taskId);
        if (draft == null || !draft.getRevision().equals(request.draftRevision())) throw conflict("TASK_DRAFT_NOT_FOUND", "提交的草稿版本不存在");
        TaskTemplateVersionVO template = templateService.getVersion(task.getTenantId(), task.getTemplateVersionId());
        Map<String, Object> formData = withAttachments(draft, template.getFields());
        var aggregateResolution = aggregateReferenceService.resolve(user, task, template.getFields(), formData, true);
        var evaluation = formRuntime.evaluate(template.getFields(), aggregateResolution.values());
        List<com.cwgsyw.platform.module.task.template.dto.TemplateValidationIssue> issues = new ArrayList<>(evaluation.issues());
        issues.addAll(validateAttachmentReferences(task, draft, template.getFields()));
        if (!issues.isEmpty()) {
            throw new com.cwgsyw.platform.module.task.template.TaskTemplateException(HttpStatus.BAD_REQUEST,
                "TASK_SUBMISSION_INVALID", "任务表单校验失败", Map.of("issues", issues));
        }

        TaskSubmission previous = currentSubmissionEntity(task.getTenantId(), taskId);
        if (previous != null) {
            previous.setStatus("superseded");
            previous.setEffective(false);
            submissionMapper.updateById(previous);
        }
        TaskSubmission submission = new TaskSubmission();
        submission.setTenantId(task.getTenantId());
        submission.setTaskId(taskId);
        submission.setTemplateVersionId(task.getTemplateVersionId());
        submission.setVersion(previous == null ? 1 : previous.getVersion() + 1);
        submission.setIdempotencyKey(request.idempotencyKey());
        submission.setFormData(new LinkedHashMap<>(evaluation.values()));
        submission.setComputedValues(new LinkedHashMap<>(evaluation.computedValues()));
        submission.setTemplateVersionSnapshot(toMap(template));
        submission.setOrganizationSnapshot(copy(task.getOrganizationSnapshot()));
        submission.setCiReferencesSnapshot(copy(task.getCiScopeSnapshot()));
        boolean needsApproval = task.getApprovalSchemeVersionId() != null;
        submission.setStatus(needsApproval ? "pending_review" : "approved");
        submission.setEffective(!needsApproval);
        submission.setSupersedesSubmissionId(previous == null ? null : previous.getId());
        submission.setContentHash(hashSubmission(evaluation.values(), evaluation.computedValues(), task));
        submission.setSubmittedBy(user.getUserId());
        submission.setSubmittedAt(LocalDateTime.now());
        submissionMapper.insert(submission);
        attachmentService.freeze(task.getTenantId(), taskId, draft.getRevision(), submission.getId(), template.getFields());
        freezeReferences(task, submission, template.getFields(), evaluation.values(), aggregateResolution.previews());
        extractFacts(task, submission, template.getFields(), evaluation.values(), !needsApproval);
        metricService.syncSubmission(task.getTenantId(), submission.getId(), !needsApproval);
        task.setCurrentSubmissionId(submission.getId());
        task.setSubmittedAt(submission.getSubmittedAt());
        task.setExecutionStatus(needsApproval ? "submitted" : "completed");
        task.setApprovalStatus(needsApproval ? "in_review" : "not_required");
        if (!needsApproval) task.setCompletedAt(submission.getSubmittedAt());
        task.setUpdatedBy(user.getUserId());
        taskMapper.updateById(task);
        Long roundId = null;
        if (needsApproval) {
            roundId = approvalApplication.start(task, submission, user.getUserId());
            task.setCurrentApprovalRoundId(roundId);
            taskMapper.updateById(task);
        }
        event(task, "submitted", user.getUserId(), details("submissionId", submission.getId(),
            "version", submission.getVersion(), "approvalRoundId", roundId));
        if (!needsApproval) {
            eventPublisher.publishEvent(new TaskLifecycleEvent(task.getTenantId(), "task_completed",
                task.getId(), submission.getId(), submission.getSubmittedAt()));
        }
        return result(task, submission, roundId);
    }

    @Transactional(rollbackFor = Exception.class)
    public TaskSummaryVO createOneOff(SecurityUser user, CreateOneOffTaskRequest request) {
        if (request.dueAt().isBefore(request.plannedStartAt())) throw BusinessException.badRequest("TASK_DATE_RANGE_INVALID", "截止时间不能早于开始时间");
        TaskTemplateVersionVO template = templateService.getVersion(user.getTenantId(), request.templateVersionId());
        if (!"published".equals(template.getStatus())) throw conflict("TASK_TEMPLATE_NOT_PUBLISHED", "只能使用已发布模板创建任务");
        User assignee = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getTenantId, user.getTenantId())
            .eq(User::getId, request.assigneeId()).eq(User::getIsDeleted, false).eq(User::getStatus, 1));
        if (assignee == null) throw BusinessException.badRequest("TASK_ASSIGNEE_NOT_FOUND", "执行人不存在或已停用");
        TaskInstance task = new TaskInstance();
        task.setTenantId(user.getTenantId());
        task.setTemplateVersionId(request.templateVersionId());
        task.setApprovalSchemeVersionId(request.approvalSchemeVersionId());
        task.setTitle(request.title());
        task.setDescription(request.description());
        task.setBusinessDate(request.plannedStartAt().toLocalDate());
        task.setPlannedStartAt(request.plannedStartAt());
        task.setDueAt(request.dueAt());
        task.setPriority(Set.of("low", "normal", "high", "critical").contains(request.priority()) ? request.priority() : "normal");
        task.setExecutionStatus("not_started");
        task.setApprovalStatus(request.approvalSchemeVersionId() == null ? "not_required" : "not_started");
        task.setAssigneeId(request.assigneeId());
        task.setGroupId(request.groupId() == null ? assignee.getGroupId() : request.groupId());
        task.setCurrentDraftRevision(0);
        task.setOrganizationSnapshot(details("userId", assignee.getId(), "username", assignee.getUsername(), "realName", assignee.getRealName(), "groupId", task.getGroupId()));
        task.setCiScopeSnapshot(request.ciScopeConfig() == null ? Map.of() : new LinkedHashMap<>(request.ciScopeConfig()));
        task.setOverdue(false);
        task.setLockVersion(0);
        task.setCreatedBy(user.getUserId());
        task.setUpdatedBy(user.getUserId());
        task.setIsDeleted(false);
        taskMapper.insert(task);
        ensureParticipant(task, request.assigneeId(), "assignee");
        event(task, "created", user.getUserId(), Map.of("oneOff", true));
        notificationOutbox.enqueue(task.getTenantId(), task.getId(), null, null, "task_created", task.getAssigneeId(),
            "notification", "task:" + task.getId() + ":created:" + task.getAssigneeId(),
            Map.of("title", task.getTitle(), "refType", "task", "refId", task.getId()), LocalDateTime.now());
        return toSummary(task, user);
    }

    public List<TaskSubmissionVO> submissions(SecurityUser user, Long taskId) {
        TaskInstance task = requireTask(user.getTenantId(), taskId);
        visibilityService.requireView(task, user);
        VisibleFields visible = visibleFields(templateService.getVersion(task.getTenantId(), task.getTemplateVersionId()),
            visibilityService.actions(task, user));
        return submissionMapper.selectList(new LambdaQueryWrapper<TaskSubmission>()
            .eq(TaskSubmission::getTenantId, user.getTenantId()).eq(TaskSubmission::getTaskId, taskId)
            .orderByDesc(TaskSubmission::getVersion)).stream().map(value -> toSubmission(value, visible)).toList();
    }

    public TaskSubmissionVO submission(SecurityUser user, Long taskId, Long submissionId) {
        TaskInstance task = requireTask(user.getTenantId(), taskId);
        visibilityService.requireView(task, user);
        VisibleFields visible = visibleFields(templateService.getVersion(task.getTenantId(), task.getTemplateVersionId()),
            visibilityService.actions(task, user));
        TaskSubmission submission = submissionMapper.selectOne(new LambdaQueryWrapper<TaskSubmission>()
            .eq(TaskSubmission::getTenantId, user.getTenantId()).eq(TaskSubmission::getTaskId, taskId)
            .eq(TaskSubmission::getId, submissionId));
        if (submission == null) throw notFound("TASK_SUBMISSION_NOT_FOUND", "提交版本不存在");
        return toSubmission(submission, visible);
    }

    public TaskDraftAttachmentService.SubmissionAttachmentContent downloadSubmissionAttachment(
            SecurityUser user, Long taskId, Long submissionId, Long attachmentId) {
        TaskInstance task = requireTask(user.getTenantId(), taskId);
        visibilityService.requireView(task, user);
        TaskSubmission submission = submissionMapper.selectOne(new LambdaQueryWrapper<TaskSubmission>()
            .eq(TaskSubmission::getTenantId, user.getTenantId())
            .eq(TaskSubmission::getTaskId, taskId)
            .eq(TaskSubmission::getId, submissionId));
        if (submission == null) throw notFound("TASK_SUBMISSION_NOT_FOUND", "提交版本不存在");
        TaskSubmissionAttachment metadata = attachmentService.findSubmission(user.getTenantId(), submissionId, attachmentId);
        VisibleFields visible = visibleFields(templateService.getVersion(task.getTenantId(), task.getTemplateVersionId()),
            visibilityService.actions(task, user));
        if (!visible.keys().contains(metadata.getFieldKey()))
            throw forbidden("TASK_ATTACHMENT_FIELD_HIDDEN", "无权读取该附件");
        TaskDraftAttachmentService.SubmissionAttachmentContent content =
            attachmentService.downloadSubmission(user.getTenantId(), submissionId, attachmentId);
        if (Boolean.TRUE.equals(content.sensitive())) {
            auditLogMapper.insert(AuditLog.builder().tenantId(user.getTenantId()).module("task")
                .action("attachment_download").targetId(attachmentId).targetType("task_submission_attachment")
                .operatorId(user.getUserId()).afterJson(null).remark("下载敏感任务附件").createdAt(LocalDateTime.now()).build());
        }
        return content;
    }

    public Map<String, Object> diff(SecurityUser user, Long taskId, Long submissionId, Long against) {
        TaskSubmissionVO current = submission(user, taskId, submissionId);
        TaskSubmissionVO previous = submission(user, taskId, against);
        Set<String> keys = new LinkedHashSet<>();
        keys.addAll(current.formData().keySet());
        keys.addAll(previous.formData().keySet());
        Map<String, Object> changes = new LinkedHashMap<>();
        for (String key : keys) {
            Object before = previous.formData().get(key);
            Object after = current.formData().get(key);
            if (!java.util.Objects.equals(before, after)) changes.put(key, Map.of("before", before == null ? "" : before, "after", after == null ? "" : after));
        }
        return Map.of("against", against, "submissionId", submissionId, "changes", changes);
    }

    public List<TaskEventVO> timeline(SecurityUser user, Long taskId) {
        TaskInstance task = requireTask(user.getTenantId(), taskId);
        visibilityService.requireView(task, user);
        return eventMapper.selectList(new LambdaQueryWrapper<TaskEvent>().eq(TaskEvent::getTenantId, user.getTenantId())
            .eq(TaskEvent::getTaskId, taskId).orderByAsc(TaskEvent::getCreatedAt).orderByAsc(TaskEvent::getId))
            .stream().map(value -> new TaskEventVO(value.getId(), value.getEventType(), value.getOperatorId(),
                value.getEventData(), value.getCreatedAt())).toList();
    }

    private void applyScope(LambdaQueryWrapper<TaskInstance> query, SecurityUser user, String scope) {
        if ("all".equals(scope)) {
            if (!visibilityService.isTenantScope(user)) throw forbidden("TASK_SCOPE_FORBIDDEN", "无权查询全部任务");
            return;
        }
        if ("group".equals(scope)) {
            Set<Long> groups = visibilityService.groupIds(user);
            if (groups.isEmpty()) query.isNull(TaskInstance::getGroupId).eq(TaskInstance::getAssigneeId, user.getUserId());
            else query.in(TaskInstance::getGroupId, groups);
            return;
        }
        List<Long> participantTaskIds = participantMapper.selectList(new LambdaQueryWrapper<TaskParticipant>()
            .eq(TaskParticipant::getTenantId, user.getTenantId()).eq(TaskParticipant::getUserId, user.getUserId()))
            .stream().map(TaskParticipant::getTaskId).distinct().toList();
        query.and(wrapper -> {
            wrapper.eq(TaskInstance::getAssigneeId, user.getUserId());
            if (!participantTaskIds.isEmpty()) wrapper.or().in(TaskInstance::getId, participantTaskIds);
        });
    }

    private TaskInstance lockTask(SecurityUser user, Long taskId) {
        TaskInstance task = taskMapper.lockById(user.getTenantId(), taskId);
        if (task == null) throw notFound("TASK_NOT_FOUND", "任务不存在");
        visibilityService.requireView(task, user);
        return task;
    }

    private TaskInstance requireTask(String tenantId, Long taskId) {
        TaskInstance task = taskMapper.selectOne(new LambdaQueryWrapper<TaskInstance>()
            .eq(TaskInstance::getTenantId, tenantId).eq(TaskInstance::getId, taskId));
        if (task == null) throw notFound("TASK_NOT_FOUND", "任务不存在");
        return task;
    }

    private TaskSummaryVO toSummary(TaskInstance task, SecurityUser user) {
        TaskTemplateVersionVO template = templateService.getVersion(task.getTenantId(), task.getTemplateVersionId());
        boolean calculatedOverdue = Boolean.TRUE.equals(task.getOverdue()) || task.getDueAt() != null
            && task.getDueAt().isBefore(LocalDateTime.now()) && !Set.of("completed", "cancelled", "exception_closed").contains(task.getExecutionStatus());
        return new TaskSummaryVO(task.getId(), task.getTitle(), task.getDescription(), task.getPlanId(),
            task.getTemplateVersionId(), template.getName(), task.getBusinessDate(), task.getPlannedStartAt(), task.getDueAt(),
            task.getPriority(), task.getExecutionStatus(), task.getApprovalStatus(), task.getAssigneeId(), task.getGroupId(),
            calculatedOverdue, visibilityService.actions(task, user));
    }

    private TaskDraftVO toDraft(TaskDraft draft) {
        return new TaskDraftVO(draft.getId(), draft.getTaskId(), draft.getRevision(), draft.getFormData(),
            attachmentService.list(draft.getTenantId(), draft.getTaskId(), draft.getRevision()), draft.getCreatedBy(), draft.getUpdatedAt());
    }

    private TaskSubmission currentSubmissionEntity(String tenantId, Long taskId) {
        return submissionMapper.selectOne(new LambdaQueryWrapper<TaskSubmission>().eq(TaskSubmission::getTenantId, tenantId)
            .eq(TaskSubmission::getTaskId, taskId).ne(TaskSubmission::getStatus, "superseded")
            .orderByDesc(TaskSubmission::getVersion).last("LIMIT 1"));
    }

    private TaskSubmissionVO currentSubmission(TaskInstance task, VisibleFields visible) {
        TaskSubmission current = currentSubmissionEntity(task.getTenantId(), task.getId());
        return current == null ? null : toSubmission(current, visible);
    }

    private TaskSubmissionVO toSubmission(TaskSubmission submission, VisibleFields visible) {
        List<TaskSubmissionAttachmentVO> attachments = submissionAttachmentMapper.selectList(
            new LambdaQueryWrapper<TaskSubmissionAttachment>().eq(TaskSubmissionAttachment::getTenantId, submission.getTenantId())
                .eq(TaskSubmissionAttachment::getSubmissionId, submission.getId()).orderByAsc(TaskSubmissionAttachment::getUploadedAt))
            .stream().filter(value -> visible.keys().contains(value.getFieldKey()))
            .map(value -> new TaskSubmissionAttachmentVO(value.getId(), value.getFieldKey(), value.getFileName(),
                value.getFileType(), value.getSizeBytes(), value.getChecksum(), value.getSensitive(), value.getUploadedAt())).toList();
        return new TaskSubmissionVO(submission.getId(), submission.getTaskId(), submission.getTemplateVersionId(),
            submission.getVersion(), visibleValues(submission.getFormData(), visible.keys()),
            visibleValues(submission.getComputedValues(), visible.keys()), submission.getOrganizationSnapshot(),
            submission.getCiReferencesSnapshot(), submission.getStatus(), submission.getEffective(), submission.getSupersedesSubmissionId(),
            submission.getSubmittedBy(), submission.getSubmittedAt(), attachments);
    }

    private VisibleFields visibleFields(TaskTemplateVersionVO template, TaskActionsVO actions) {
        String role = actions.canViewSensitive() ? "executor" : "copied";
        List<TaskFieldDefinition> fields = template.getFields().stream()
            .filter(field -> formRuntime.fieldVisibleForRole(field, role))
            .filter(field -> !Boolean.TRUE.equals(field.getSensitive()) || actions.canViewSensitive())
            .toList();
        return new VisibleFields(fields, fields.stream().map(TaskFieldDefinition::getKey)
            .collect(java.util.stream.Collectors.toUnmodifiableSet()));
    }

    private TaskTemplateVersionVO visibleTemplate(TaskTemplateVersionVO template, List<TaskFieldDefinition> fields) {
        return TaskTemplateVersionVO.builder().id(template.getId()).templateId(template.getTemplateId())
            .version(template.getVersion()).status(template.getStatus()).name(template.getName())
            .description(template.getDescription()).instructions(template.getInstructions()).layout(template.getLayout())
            .completionPolicy(template.getCompletionPolicy()).defaultAssignment(template.getDefaultAssignment())
            .defaultReminder(template.getDefaultReminder())
            .defaultApprovalSchemeVersionId(template.getDefaultApprovalSchemeVersionId())
            .publishedBy(template.getPublishedBy()).publishedAt(template.getPublishedAt())
            .updatedAt(template.getUpdatedAt()).fields(fields).build();
    }

    private Map<String, Object> visibleValues(Map<String, Object> values, Set<String> keys) {
        if (values == null || values.isEmpty()) return Map.of();
        Map<String, Object> visible = new LinkedHashMap<>();
        values.forEach((key, value) -> { if (keys.contains(key)) visible.put(key, value); });
        return visible;
    }

    private record VisibleFields(List<TaskFieldDefinition> fields, Set<String> keys) {
    }

    private Map<String, Object> withAttachments(TaskDraft draft, List<TaskFieldDefinition> fields) {
        Map<String, Object> values = new LinkedHashMap<>(draft.getFormData());
        Map<String, List<Long>> byField = attachmentService.find(draft.getTenantId(), draft.getTaskId(), draft.getRevision()).stream()
            .collect(java.util.stream.Collectors.groupingBy(TaskDraftAttachment::getFieldKey, LinkedHashMap::new,
                java.util.stream.Collectors.mapping(TaskDraftAttachment::getId, java.util.stream.Collectors.toList())));
        fields.stream().filter(field -> Set.of("file", "image").contains(field.getType()))
            .forEach(field -> values.put(field.getKey(), byField.getOrDefault(field.getKey(), List.of())));
        return values;
    }

    private List<com.cwgsyw.platform.module.task.template.dto.TemplateValidationIssue> validateAttachmentReferences(
            TaskInstance task, TaskDraft draft, List<TaskFieldDefinition> fields) {
        Set<String> allowed = fields.stream().filter(field -> Set.of("file", "image").contains(field.getType()))
            .map(TaskFieldDefinition::getKey).collect(java.util.stream.Collectors.toSet());
        return attachmentService.find(task.getTenantId(), task.getId(), draft.getRevision()).stream()
            .filter(attachment -> !allowed.contains(attachment.getFieldKey()))
            .map(attachment -> new com.cwgsyw.platform.module.task.template.dto.TemplateValidationIssue(
                "TASK_ATTACHMENT_FIELD_INVALID", attachment.getFieldKey(), "attachments." + attachment.getId(), "附件字段不存在"))
            .toList();
    }

    private void freezeReferences(TaskInstance task, TaskSubmission submission, List<TaskFieldDefinition> fields,
                                  Map<String, Object> values, List<AggregateReferencePreviewVO> aggregateReferences) {
        for (TaskFieldDefinition field : fields) {
            if (!Set.of("ci_scope", "relation").contains(field.getType())) continue;
            Object value = values.get(field.getKey());
            if (value instanceof Collection<?> collection) {
                collection.stream().filter(Map.class::isInstance).map(Map.class::cast)
                    .forEach(reference -> insertReference(task, submission, field, reference));
            } else if (value instanceof Map<?, ?> reference) {
                insertReference(task, submission, field, reference);
            }
        }
        for (AggregateReferencePreviewVO aggregateReference : aggregateReferences) {
            insertAggregateReference(task, submission, aggregateReference);
        }
    }

    private void insertAggregateReference(TaskInstance task, TaskSubmission submission,
                                          AggregateReferencePreviewVO aggregateReference) {
        TaskSubmissionReference row = new TaskSubmissionReference();
        row.setTenantId(task.getTenantId());
        row.setSubmissionId(submission.getId());
        row.setTaskId(task.getId());
        row.setFieldKey(aggregateReference.fieldKey());
        row.setRefType("aggregate_reference");
        row.setRefKey(String.valueOf(aggregateReference.metricId()));
        row.setSourceLevel(aggregateReference.groupId() == null ? null : "group");
        row.setRefSnapshot(aggregateReferenceService.snapshot(aggregateReference));
        submissionReferenceMapper.insert(row);
    }

    private void insertReference(TaskInstance task, TaskSubmission submission, TaskFieldDefinition field, Map<?, ?> reference) {
        Object key = reference.get("key") == null ? reference.get("id") : reference.get("key");
        if (key == null) return;
        TaskSubmissionReference row = new TaskSubmissionReference();
        row.setTenantId(task.getTenantId());
        row.setSubmissionId(submission.getId());
        row.setTaskId(task.getId());
        row.setFieldKey(field.getKey());
        Object referenceType = reference.get("type");
        row.setRefType(referenceType == null ? field.getType() : String.valueOf(referenceType));
        row.setRefKey(String.valueOf(key));
        row.setSourceLevel(reference.get("level") == null ? null : String.valueOf(reference.get("level")));
        row.setRefSnapshot(toStringMap(reference));
        submissionReferenceMapper.insert(row);
    }

    private void extractFacts(TaskInstance task, TaskSubmission submission, List<TaskFieldDefinition> fields,
                              Map<String, Object> values, boolean active) {
        LocalDateTime now = LocalDateTime.now();
        if (active) fieldFactMapper.deactivateTaskFacts(task.getTenantId(), task.getId(), now);
        for (TaskFieldDefinition field : fields) {
            if (Boolean.TRUE.equals(field.getSensitive()) || field.getAnalytics() == null
                    || !Boolean.TRUE.equals(field.getAnalytics().get("enabled"))) continue;
            Object value = values.get(field.getKey());
            if (value == null) continue;
            if (Set.of("file", "image").contains(field.getType())) {
                submissionAttachmentMapper.selectList(new LambdaQueryWrapper<TaskSubmissionAttachment>()
                    .eq(TaskSubmissionAttachment::getTenantId, task.getTenantId())
                    .eq(TaskSubmissionAttachment::getSubmissionId, submission.getId())
                    .eq(TaskSubmissionAttachment::getFieldKey, field.getKey()))
                    .forEach(attachment -> insertAttachmentFact(task, submission, field, attachment, active, now));
            } else if (Set.of("table", "repeater").contains(field.getType()) && value instanceof Collection<?> rows) {
                extractTableFacts(task, submission, field, rows, active, now);
            } else if (value instanceof Collection<?> collection
                    && Set.of("multi_select", "tags", "ci_scope", "relation").contains(field.getType())) {
                for (Object item : collection) {
                    insertFact(task, submission, field, item, null, null, active, now);
                }
            } else {
                insertFact(task, submission, field, value, null, null, active, now);
            }
        }
    }

    private void extractTableFacts(TaskInstance task, TaskSubmission submission, TaskFieldDefinition field,
                                   Collection<?> rows, boolean active, LocalDateTime now) {
        List<Map<String, Object>> columns = mapList(field.getValidation() == null ? null : field.getValidation().get("columns"));
        int rowIndex = 0;
        for (Object rawRow : rows) {
            if (!(rawRow instanceof Map<?, ?> row)) {
                rowIndex++;
                continue;
            }
            String rowKey = row.get("key") == null ? String.valueOf(rowIndex) : String.valueOf(row.get("key"));
            for (Map<String, Object> column : columns) {
                String key = column.get("key") == null ? null : String.valueOf(column.get("key"));
                if (key == null || !Boolean.TRUE.equals(column.get("analyticsEnabled")) && column.get("analytics") == null) continue;
                Object cell = row.get(key);
                if (cell == null) continue;
                TaskFieldDefinition cellField = new TaskFieldDefinition();
                cellField.setId(field.getId());
                cellField.setKey(field.getKey());
                cellField.setLabel(String.valueOf(column.getOrDefault("label", key)));
                cellField.setType(column.get("type") == null ? "text" : String.valueOf(column.get("type")));
                insertFact(task, submission, cellField, cell, key, rowKey, active, now);
            }
            rowIndex++;
        }
    }

    private void insertAttachmentFact(TaskInstance task, TaskSubmission submission, TaskFieldDefinition field,
                                      TaskSubmissionAttachment attachment, boolean active, LocalDateTime now) {
        TaskFieldFact fact = baseFact(task, submission, field, active, now);
        fact.setValueText(attachment.getFileName());
        fact.setValueJson(details("fileName", attachment.getFileName(), "fileType", attachment.getFileType(),
            "sizeBytes", attachment.getSizeBytes(), "checksum", attachment.getChecksum()));
        fact.setAttachmentId(attachment.getId());
        fieldFactMapper.insert(fact);
    }

    private void insertFact(TaskInstance task, TaskSubmission submission, TaskFieldDefinition field, Object value,
                            String subFieldKey, String rowKey, boolean active, LocalDateTime now) {
        TaskFieldFact fact = baseFact(task, submission, field, active, now);
        fact.setSubFieldKey(subFieldKey);
        fact.setRowKey(rowKey);
        if (value instanceof Map<?, ?> reference && Set.of("ci_scope", "relation", "user", "group", "role").contains(field.getType())) {
            Object type = reference.get("type");
            Object key = reference.get("key") == null ? reference.get("id") : reference.get("key");
            Object label = reference.get("label") == null ? reference.get("name") : reference.get("label");
            fact.setReferenceType(type == null ? field.getType() : String.valueOf(type));
            fact.setReferenceKey(key == null ? null : String.valueOf(key));
            fact.setReferenceLabel(label == null ? null : String.valueOf(label));
            fact.setValueJson(toStringMap(reference));
        } else if ("multi_select".equals(field.getType()) || "tags".equals(field.getType())) {
            fact.setValueText(String.valueOf(value));
        } else {
            applyFactValue(fact, value);
        }
        fieldFactMapper.insert(fact);
    }

    private TaskFieldFact baseFact(TaskInstance task, TaskSubmission submission, TaskFieldDefinition field,
                                   boolean active, LocalDateTime now) {
        TaskFieldFact fact = new TaskFieldFact();
        fact.setTenantId(task.getTenantId());
        fact.setSubmissionId(submission.getId());
        fact.setTaskId(task.getId());
        fact.setTemplateVersionId(task.getTemplateVersionId());
        fact.setFieldId(field.getId());
        fact.setFieldKey(field.getKey());
        fact.setFieldType(field.getType());
        fact.setBusinessDate(task.getBusinessDate());
        Map<String, Object> organization = task.getOrganizationSnapshot() == null ? Map.of() : task.getOrganizationSnapshot();
        fact.setOwnerUserId(task.getAssigneeId());
        fact.setOwnerUserName(firstText(organization, "realName", "username"));
        fact.setOwnerGroupId(task.getGroupId());
        fact.setOwnerGroupName(firstText(organization, "groupName"));
        fact.setDimensionSnapshot(details("businessDate", task.getBusinessDate() == null ? null : task.getBusinessDate().toString(),
            "assigneeId", task.getAssigneeId(),
            "assigneeName", fact.getOwnerUserName(), "groupId", task.getGroupId(), "groupName", fact.getOwnerGroupName(),
            "organization", organization, "ciScope", task.getCiScopeSnapshot()));
        fact.setIsActive(active);
        fact.setActivatedAt(now);
        return fact;
    }

    private String firstText(Map<String, Object> values, String... keys) {
        for (String key : keys) {
            Object value = values.get(key);
            if (value != null && !String.valueOf(value).isBlank()) return String.valueOf(value);
        }
        return null;
    }

    private List<Map<String, Object>> mapList(Object value) {
        if (!(value instanceof Collection<?> collection)) return List.of();
        return collection.stream().filter(Map.class::isInstance).map(Map.class::cast)
            .map(this::toStringMap).toList();
    }

    private void applyFactValue(TaskFieldFact fact, Object value) {
        if (value instanceof Number || Set.of("number", "money", "percentage", "rating", "duration", "formula", "aggregate_reference").contains(fact.getFieldType())) {
            try { fact.setValueNumber(new BigDecimal(String.valueOf(value))); return; } catch (NumberFormatException ignored) { }
        }
        if (value instanceof Boolean bool) { fact.setValueBoolean(bool); return; }
        if ("date".equals(fact.getFieldType())) {
            try { fact.setValueDate(LocalDate.parse(String.valueOf(value))); return; } catch (Exception ignored) { }
        }
        if ("datetime".equals(fact.getFieldType())) {
            try { fact.setValueDatetime(LocalDateTime.parse(String.valueOf(value))); return; } catch (Exception ignored) { }
        }
        if (value instanceof Map<?, ?> || value instanceof Collection<?>) fact.setValueJson(value);
        else fact.setValueText(String.valueOf(value));
    }

    private void ensureParticipant(TaskInstance task, Long userId, String role) {
        long count = participantMapper.selectCount(new LambdaQueryWrapper<TaskParticipant>().eq(TaskParticipant::getTaskId, task.getId())
            .eq(TaskParticipant::getUserId, userId).eq(TaskParticipant::getRole, role));
        if (count > 0) return;
        TaskParticipant participant = new TaskParticipant();
        participant.setTenantId(task.getTenantId());
        participant.setTaskId(task.getId());
        participant.setUserId(userId);
        participant.setRole(role);
        participantMapper.insert(participant);
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

    private TaskSubmissionResultVO result(TaskInstance task, TaskSubmission submission, Long roundId) {
        return new TaskSubmissionResultVO(task.getId(), submission.getId(), submission.getVersion(),
            task.getExecutionStatus(), task.getApprovalStatus(), roundId);
    }

    private Map<String, Object> toMap(TaskTemplateVersionVO template) {
        return objectMapper.convertValue(template, new com.fasterxml.jackson.core.type.TypeReference<>() {});
    }

    private Map<String, Object> copy(Map<String, Object> values) {
        return values == null ? Map.of() : new LinkedHashMap<>(values);
    }

    private String hashSubmission(Map<String, Object> values, Map<String, Object> computed, TaskInstance task) {
        try {
            Map<String, Object> hashInput = new LinkedHashMap<>();
            hashInput.put("templateVersionId", task.getTemplateVersionId());
            hashInput.put("formData", values);
            hashInput.put("computedValues", computed);
            hashInput.put("organization", task.getOrganizationSnapshot());
            hashInput.put("ciScope", task.getCiScopeSnapshot());
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(objectMapper.writeValueAsString(hashInput).getBytes(StandardCharsets.UTF_8)));
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("提交内容无法序列化", exception);
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    private Map<String, Object> details(Object... pairs) {
        Map<String, Object> values = new LinkedHashMap<>();
        for (int index = 0; index + 1 < pairs.length; index += 2) {
            if (pairs[index + 1] != null) values.put(String.valueOf(pairs[index]), pairs[index + 1]);
        }
        return values;
    }

    private Map<String, Object> toStringMap(Map<?, ?> source) {
        Map<String, Object> values = new LinkedHashMap<>();
        source.forEach((key, value) -> values.put(String.valueOf(key), value));
        return values;
    }

    private void requireAction(boolean allowed, String code, String message) {
        if (!allowed) throw forbidden(code, message);
    }

    private BusinessException notFound(String code, String message) { return new BusinessException(HttpStatus.NOT_FOUND, code, message); }
    private BusinessException conflict(String code, String message) { return new BusinessException(HttpStatus.CONFLICT, code, message); }
    private BusinessException forbidden(String code, String message) { return BusinessException.forbidden(code, message); }
}
