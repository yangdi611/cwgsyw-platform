package com.cwgsyw.platform.module.task.approval;

import com.cwgsyw.platform.module.approval.entity.ApprovalAction;
import com.cwgsyw.platform.module.approval.entity.ApprovalRound;
import com.cwgsyw.platform.module.approval.entity.ApprovalSchemeVersion;
import com.cwgsyw.platform.module.approval.mapper.ApprovalActionMapper;
import com.cwgsyw.platform.module.approval.mapper.ApprovalRoundMapper;
import com.cwgsyw.platform.module.approval.mapper.ApprovalSchemeVersionMapper;
import com.cwgsyw.platform.module.approval.dto.ApprovalActionRequest;
import com.cwgsyw.platform.module.approval.dto.ApprovalAttachmentCommentRequest;
import com.cwgsyw.platform.module.approval.dto.ApprovalFieldCommentRequest;
import com.cwgsyw.platform.module.approval.service.ApprovalRuntimeService;
import com.cwgsyw.platform.module.approval.service.ApprovalSchemeService;
import com.cwgsyw.platform.module.approval.workflow.ApprovalWorkflowTask;
import com.cwgsyw.platform.module.approval.workflow.TaskApprovalWorkflowPort;
import com.cwgsyw.platform.module.task.notification.TaskNotificationOutbox;
import com.cwgsyw.platform.module.task.metric.TaskMetricService;
import com.cwgsyw.platform.module.task.runtime.entity.TaskDraft;
import com.cwgsyw.platform.module.task.runtime.entity.TaskEvent;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.entity.TaskSubmission;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskDraftMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskEventMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskFieldFactMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskInstanceMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskSubmissionAttachmentMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskSubmissionMapper;
import com.cwgsyw.platform.module.task.runtime.service.TaskDraftAttachmentService;
import com.cwgsyw.platform.module.task.runtime.service.TaskVisibilityService;
import com.cwgsyw.platform.module.task.template.service.TaskTemplateService;
import com.cwgsyw.platform.module.task.template.form.ExpressionEngine;
import com.cwgsyw.platform.module.task.template.form.FieldTypeRegistry;
import com.cwgsyw.platform.module.task.template.form.TemplateFormRuntime;
import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateVersionVO;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.workflow.event.WorkflowCompletedEvent;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApprovalRuntimeServiceTest {
    @Mock ApprovalRoundMapper roundMapper;
    @Mock ApprovalActionMapper actionMapper;
    @Mock ApprovalSchemeVersionMapper schemeVersionMapper;
    @Mock TaskApprovalWorkflowPort workflowPort;
    @Mock TaskInstanceMapper taskMapper;
    @Mock TaskSubmissionMapper submissionMapper;
    @Mock TaskSubmissionAttachmentMapper submissionAttachmentMapper;
    @Mock TaskDraftMapper draftMapper;
    @Mock TaskFieldFactMapper factMapper;
    @Mock TaskEventMapper eventMapper;
    @Mock TaskTemplateService templateService;
    @Mock UserMapper userMapper;
    @Mock TaskMetricService metricService;
    @Mock AuditLogMapper auditLogMapper;
    @Mock ApplicationEventPublisher eventPublisher;

    private ApprovalRuntimeService service;

    @BeforeEach
    void setUp() {
        ApprovalSchemeService schemeService = new ApprovalSchemeService(null, schemeVersionMapper,
            null, null, null, null, new ObjectMapper().findAndRegisterModules());
        TaskDraftAttachmentService attachmentService = new TaskDraftAttachmentService(null, null, null, null) {
            @Override
            public Map<String, List<Long>> restoreFromSubmission(String tenantId, Long taskId,
                                                                 Integer revision,
                                                                 List<com.cwgsyw.platform.module.task.runtime.entity.TaskSubmissionAttachment> attachments) {
                return Map.of();
            }
        };
        service = new ApprovalRuntimeService(roundMapper, actionMapper, schemeService, workflowPort,
            taskMapper, submissionMapper, submissionAttachmentMapper, draftMapper, factMapper,
            eventMapper, templateService, new TemplateFormRuntime(new FieldTypeRegistry(), new ExpressionEngine()),
            null, attachmentService, null, metricService,
            userMapper, new ObjectMapper().findAndRegisterModules(), auditLogMapper, eventPublisher);
    }

    @Test
    void approvedCallbackActivatesSubmissionFactsAndCompletesTask() {
        ApprovalRound round = round("in_review", null);
        TaskSubmission submission = submission();
        TaskInstance task = task();
        ApprovalAction action = action("approve", "同意");
        when(roundMapper.lockByProcessInstanceId("tenant-a", "process-1")).thenReturn(round);
        when(submissionMapper.selectOne(any())).thenReturn(submission);
        when(taskMapper.lockById("tenant-a", 10L)).thenReturn(task);
        when(actionMapper.selectOne(any())).thenReturn(action);

        service.onWorkflowCompleted(event(true));

        assertThat(round.getStatus()).isEqualTo("approved");
        assertThat(submission.getStatus()).isEqualTo("approved");
        assertThat(submission.getEffective()).isTrue();
        assertThat(task.getExecutionStatus()).isEqualTo("completed");
        assertThat(task.getApprovalStatus()).isEqualTo("approved");
        verify(factMapper).deactivateTaskFacts(any(), any(), any());
        verify(factMapper).activateSubmissionFacts("tenant-a", 20L, eventTime());
    }

    @Test
    void returnedCallbackCreatesEditableDraftAndExposesReasonInTimeline() {
        ApprovalRound round = round("in_review", null);
        TaskSubmission submission = submission();
        TaskInstance task = task();
        task.setCurrentDraftRevision(3);
        ApprovalAction action = action("return_for_changes", "缺少恢复验证记录");
        when(roundMapper.lockByProcessInstanceId("tenant-a", "process-1")).thenReturn(round);
        when(submissionMapper.selectOne(any())).thenReturn(submission);
        when(taskMapper.lockById("tenant-a", 10L)).thenReturn(task);
        when(actionMapper.selectOne(any())).thenReturn(action);
        when(submissionAttachmentMapper.selectList(any())).thenReturn(List.of());

        service.onWorkflowCompleted(event(false));

        assertThat(round.getStatus()).isEqualTo("changes_requested");
        assertThat(submission.getStatus()).isEqualTo("changes_requested");
        assertThat(task.getExecutionStatus()).isEqualTo("changes_requested");
        assertThat(task.getApprovalStatus()).isEqualTo("changes_requested");
        assertThat(task.getCurrentDraftRevision()).isEqualTo(4);
        ArgumentCaptor<TaskDraft> draft = ArgumentCaptor.forClass(TaskDraft.class);
        verify(draftMapper).insert(draft.capture());
        assertThat(draft.getValue().getFormData()).containsEntry("summary", "巡检完成");
        ArgumentCaptor<TaskEvent> timeline = ArgumentCaptor.forClass(TaskEvent.class);
        verify(eventMapper).insert(timeline.capture());
        assertThat(timeline.getValue().getEventType()).isEqualTo("approval_returned");
        assertThat(timeline.getValue().getEventData())
            .containsEntry("comment", "缺少恢复验证记录")
            .containsEntry("draftRevision", 4);
    }

    @Test
    void terminatedCallbackCancelsTaskWithApprovalReason() {
        ApprovalRound round = round("in_review", null);
        TaskSubmission submission = submission();
        TaskInstance task = task();
        ApprovalAction action = action("terminate", "任务目标已失效");
        when(roundMapper.lockByProcessInstanceId("tenant-a", "process-1")).thenReturn(round);
        when(submissionMapper.selectOne(any())).thenReturn(submission);
        when(taskMapper.lockById("tenant-a", 10L)).thenReturn(task);
        when(actionMapper.selectOne(any())).thenReturn(action);

        service.onWorkflowCompleted(event(false));

        assertThat(round.getStatus()).isEqualTo("terminated");
        assertThat(submission.getStatus()).isEqualTo("terminated");
        assertThat(task.getExecutionStatus()).isEqualTo("cancelled");
        assertThat(task.getApprovalStatus()).isEqualTo("terminated");
        assertThat(task.getCancelReason()).isEqualTo("任务目标已失效");
    }

    @Test
    void repeatedCallbackDoesNotWriteAgain() {
        ApprovalRound completed = round("approved", "approved");
        completed.setEndedAt(eventTime());
        when(roundMapper.lockByProcessInstanceId("tenant-a", "process-1")).thenReturn(completed);

        service.onWorkflowCompleted(event(true));

        verify(submissionMapper, never()).selectOne(any());
        verify(taskMapper, never()).updateById(any(TaskInstance.class));
        verify(eventMapper, never()).insert(any(TaskEvent.class));
    }

    @Test
    void pendingIsEmptyWithoutBothApprovalPermissions() {
        SecurityUser reader = user(Set.of("work_item:read"));

        var result = service.pending(reader, null, 1, 20);

        assertThat(result.getRecords()).isEmpty();
        assertThat(result.getTotal()).isZero();
        verify(workflowPort, never()).listPending(any());
    }

    @Test
    void returnForChangesRequiresReasonBeforeAnyWrite() {
        ApprovalActionRequest request = new ApprovalActionRequest("return_for_changes", " ", List.of(), List.of());

        assertThatThrownBy(() -> service.act(approver(), "flow-task-1", request))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("APPROVAL_COMMENT_REQUIRED"));

        verify(actionMapper, never()).insert(any(ApprovalAction.class));
        verify(workflowPort, never()).complete(any(), any(), any(Boolean.class), any(), any());
    }

    @Test
    void invalidFieldCommentIsRejectedWithoutActionWrite() {
        stubPendingAction();
        ApprovalActionRequest request = new ApprovalActionRequest("approve", "同意",
            List.of(new ApprovalFieldCommentRequest("unknown", "error", "字段不存在")), List.of());

        assertThatThrownBy(() -> service.act(approver(), "flow-task-1", request))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("APPROVAL_FIELD_COMMENT_INVALID"));

        verify(actionMapper, never()).insert(any(ApprovalAction.class));
        verify(workflowPort, never()).complete(any(), any(), any(Boolean.class), any(), any());
    }

    @Test
    void invalidAttachmentCommentIsRejectedWithoutActionWrite() {
        stubPendingAction();
        when(submissionAttachmentMapper.selectList(any())).thenReturn(List.of(attachment(123L)));
        ApprovalActionRequest request = new ApprovalActionRequest("approve", "同意", List.of(),
            List.of(new ApprovalAttachmentCommentRequest(999L, "附件不完整")));

        assertThatThrownBy(() -> service.act(approver(), "flow-task-1", request))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("APPROVAL_ATTACHMENT_COMMENT_INVALID"));

        verify(actionMapper, never()).insert(any(ApprovalAction.class));
        verify(workflowPort, never()).complete(any(), any(), any(Boolean.class), any(), any());
    }

    @Test
    void validFieldAndAttachmentCommentsArePersisted() {
        stubPendingAction();
        when(submissionAttachmentMapper.selectList(any())).thenReturn(List.of(attachment(123L)));
        when(actionMapper.selectList(any())).thenReturn(List.of());
        doAnswer(invocation -> {
            ApprovalAction action = invocation.getArgument(0);
            action.setId(50L);
            return 1;
        }).when(actionMapper).insert(any(ApprovalAction.class));
        ApprovalActionRequest request = new ApprovalActionRequest("approve", "同意",
            List.of(new ApprovalFieldCommentRequest("summary", "warning", "请下次补充明细")),
            List.of(new ApprovalAttachmentCommentRequest(123L, "附件已核验")));

        service.act(approver(), "flow-task-1", request);

        ArgumentCaptor<ApprovalAction> action = ArgumentCaptor.forClass(ApprovalAction.class);
        verify(actionMapper).insert(action.capture());
        assertThat(action.getValue().getFieldComments().getFirst())
            .containsEntry("fieldKey", "summary")
            .containsEntry("severity", "warning")
            .containsEntry("comment", "请下次补充明细");
        assertThat(action.getValue().getAttachmentComments().getFirst())
            .containsEntry("attachmentId", 123L)
            .containsEntry("comment", "附件已核验");
        verify(workflowPort).complete(any(), any(), org.mockito.ArgumentMatchers.eq(true),
            org.mockito.ArgumentMatchers.eq("同意"), any());
    }

    @Test
    void approvalDetailFiltersFieldsHiddenFromApprover() {
        stubPendingAction();
        TaskSubmission submission = submission();
        submission.setFormData(Map.of("summary", "巡检完成", "secret", "内部口令"));
        when(submissionMapper.selectOne(any())).thenReturn(submission);
        when(actionMapper.selectList(any())).thenReturn(List.of());
        when(submissionAttachmentMapper.selectList(any())).thenReturn(List.of());

        var detail = service.detail(approver(), "flow-task-1");

        assertThat(detail.fields()).extracting(TaskFieldDefinition::getKey)
            .contains("summary", "evidence")
            .doesNotContain("secret");
        assertThat(detail.formData()).containsEntry("summary", "巡检完成").doesNotContainKey("secret");
    }

    private ApprovalRound round(String status, String result) {
        ApprovalRound round = new ApprovalRound();
        round.setId(30L);
        round.setTenantId("tenant-a");
        round.setTaskId(10L);
        round.setSubmissionId(20L);
        round.setSchemeVersionId(40L);
        round.setRoundNumber(1);
        round.setProcessInstanceId("process-1");
        round.setStatus(status);
        round.setResult(result);
        round.setStartedBy(7L);
        return round;
    }

    private TaskSubmission submission() {
        TaskSubmission submission = new TaskSubmission();
        submission.setId(20L);
        submission.setTenantId("tenant-a");
        submission.setTaskId(10L);
        submission.setVersion(1);
        submission.setStatus("pending_review");
        submission.setEffective(false);
        submission.setFormData(Map.of("summary", "巡检完成"));
        return submission;
    }

    private TaskInstance task() {
        TaskInstance task = new TaskInstance();
        task.setId(10L);
        task.setTenantId("tenant-a");
        task.setExecutionStatus("submitted");
        task.setApprovalStatus("in_review");
        task.setCurrentDraftRevision(1);
        task.setCurrentSubmissionId(20L);
        task.setCurrentApprovalRoundId(30L);
        task.setTemplateVersionId(100L);
        task.setAssigneeId(null);
        return task;
    }

    private void stubPendingAction() {
        ApprovalRound round = round("in_review", null);
        when(workflowPort.requirePending(any(), org.mockito.ArgumentMatchers.eq("flow-task-1")))
            .thenReturn(workflowTask());
        when(roundMapper.selectOne(any())).thenReturn(round);
        when(submissionMapper.selectOne(any())).thenReturn(submission());
        when(taskMapper.selectOne(any())).thenReturn(task());
        when(schemeVersionMapper.selectOne(any())).thenReturn(schemeVersion());
        when(templateService.getVersion("tenant-a", 100L)).thenReturn(template());
    }

    private ApprovalWorkflowTask workflowTask() {
        return new ApprovalWorkflowTask("flow-task-1", "process-1", "definition-1",
            "leader_approval", "组长审批", 20L, 30L, eventTime());
    }

    private ApprovalSchemeVersion schemeVersion() {
        ApprovalSchemeVersion version = new ApprovalSchemeVersion();
        version.setId(40L);
        version.setTenantId("tenant-a");
        version.setStatus("published");
        version.setProcessDefinitionId("definition-1");
        version.setDefinitionConfig(Map.of(
            "nodes", List.of(Map.of("key", "leader_approval", "name", "组长审批",
                "approverType", "user", "userId", 8L)),
            "allowedActions", List.of("approve", "return_for_changes", "terminate")));
        return version;
    }

    private TaskTemplateVersionVO template() {
        TaskFieldDefinition field = field("summary", "巡检结果", "textarea");
        TaskFieldDefinition evidence = field("evidence", "巡检附件", "file");
        TaskFieldDefinition secret = field("secret", "内部口令", "text");
        secret.setVisibility(Map.of("approver", "hidden", "executor", "read_write"));
        secret.setSensitive(true);
        return TaskTemplateVersionVO.builder().id(100L).templateId(70L).version(1)
            .status("published").name("数据库巡检").fields(List.of(field, evidence, secret)).build();
    }

    private TaskFieldDefinition field(String key, String label, String type) {
        TaskFieldDefinition field = new TaskFieldDefinition();
        field.setKey(key);
        field.setLabel(label);
        field.setType(type);
        return field;
    }

    private com.cwgsyw.platform.module.task.runtime.entity.TaskSubmissionAttachment attachment(Long id) {
        var attachment = new com.cwgsyw.platform.module.task.runtime.entity.TaskSubmissionAttachment();
        attachment.setId(id);
        attachment.setTenantId("tenant-a");
        attachment.setSubmissionId(20L);
        attachment.setFieldKey("evidence");
        return attachment;
    }

    private SecurityUser approver() {
        return user(Set.of("work_item:read", "work_item:approve", "workflow:approve"));
    }

    private SecurityUser user(Set<String> permissions) {
        return new SecurityUser(8L, "approver", "", "tenant-a", 99L, "group", permissions);
    }

    private ApprovalAction action(String actionName, String comment) {
        ApprovalAction action = new ApprovalAction();
        action.setId(50L);
        action.setRoundId(30L);
        action.setSubmissionId(20L);
        action.setAction(actionName);
        action.setApproverId(8L);
        action.setComment(comment);
        return action;
    }

    private WorkflowCompletedEvent event(boolean approved) {
        return WorkflowCompletedEvent.builder()
            .tenantId("tenant-a")
            .businessType("task_submission")
            .businessId("20")
            .businessKey("task_submission:20")
            .processInstanceId("process-1")
            .processDefinitionId("definition-1")
            .approved(approved)
            .completedAt(eventTime())
            .build();
    }

    private LocalDateTime eventTime() {
        return LocalDateTime.of(2026, 7, 23, 10, 30);
    }
}
