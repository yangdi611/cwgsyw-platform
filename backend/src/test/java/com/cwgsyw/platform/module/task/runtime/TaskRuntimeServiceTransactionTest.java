package com.cwgsyw.platform.module.task.runtime;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.approval.service.ApprovalApplicationPort;
import com.cwgsyw.platform.module.task.notification.TaskNotificationOutbox;
import com.cwgsyw.platform.module.task.metric.TaskMetricService;
import com.cwgsyw.platform.module.task.runtime.dto.CreateTaskSubmissionRequest;
import com.cwgsyw.platform.module.task.runtime.dto.ReassignTaskRequest;
import com.cwgsyw.platform.module.task.runtime.dto.SaveTaskDraftRequest;
import com.cwgsyw.platform.module.task.runtime.dto.TaskActionsVO;
import com.cwgsyw.platform.module.task.runtime.entity.TaskDraft;
import com.cwgsyw.platform.module.task.runtime.entity.TaskFieldFact;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.entity.TaskSubmission;
import com.cwgsyw.platform.module.task.runtime.entity.TaskSubmissionAttachment;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskDraftMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskEventMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskFieldFactMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskInstanceMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskParticipantMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskSubmissionAttachmentMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskSubmissionMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskSubmissionReferenceMapper;
import com.cwgsyw.platform.module.task.runtime.service.TaskDraftAttachmentService;
import com.cwgsyw.platform.module.task.runtime.service.TaskAggregateReferenceService;
import com.cwgsyw.platform.module.task.runtime.service.TaskRuntimeService;
import com.cwgsyw.platform.module.task.runtime.service.TaskVisibilityService;
import com.cwgsyw.platform.module.task.template.TaskTemplateException;
import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateVersionVO;
import com.cwgsyw.platform.module.task.template.form.ExpressionEngine;
import com.cwgsyw.platform.module.task.template.form.FieldTypeRegistry;
import com.cwgsyw.platform.module.task.template.form.TemplateFormRuntime;
import com.cwgsyw.platform.module.task.template.service.TaskTemplateService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskRuntimeServiceTransactionTest {
    @Mock TaskInstanceMapper taskMapper;
    @Mock TaskDraftMapper draftMapper;
    @Mock TaskSubmissionMapper submissionMapper;
    @Mock TaskSubmissionAttachmentMapper submissionAttachmentMapper;
    @Mock TaskSubmissionReferenceMapper referenceMapper;
    @Mock TaskParticipantMapper participantMapper;
    @Mock TaskEventMapper eventMapper;
    @Mock TaskFieldFactMapper factMapper;
    @Mock TaskTemplateService templateService;
    @Mock UserMapper userMapper;
    @Mock TaskNotificationOutbox notificationOutbox;
    @Mock ApprovalApplicationPort approvalApplication;
    @Mock TaskMetricService metricService;
    @Mock AuditLogMapper auditLogMapper;
    @Mock ApplicationEventPublisher eventPublisher;
    private TaskRuntimeService service;
    private SecurityUser user;
    private java.util.concurrent.atomic.AtomicInteger actionCalls;
    private java.util.concurrent.atomic.AtomicInteger attachmentDownloads;
    private List<com.cwgsyw.platform.module.task.runtime.entity.TaskDraftAttachment> attachments;

    @BeforeEach
    void setUp() {
        actionCalls = new java.util.concurrent.atomic.AtomicInteger();
        attachmentDownloads = new java.util.concurrent.atomic.AtomicInteger();
        attachments = List.of();
        TaskVisibilityService visibilityService = new TaskVisibilityService(null, null) {
            @Override
            public void requireView(TaskInstance task, SecurityUser currentUser) {
            }

            @Override
            public TaskActionsVO actions(TaskInstance task, SecurityUser currentUser) {
                actionCalls.incrementAndGet();
                return TaskRuntimeServiceTransactionTest.this.actions(true, true);
            }
        };
        TaskDraftAttachmentService attachmentService = new TaskDraftAttachmentService(null, null, null, null) {
            @Override
            public List<com.cwgsyw.platform.module.task.runtime.entity.TaskDraftAttachment> find(
                    String tenantId, Long taskId, Integer revision) {
                return attachments;
            }

            @Override
            public void carryForward(String tenantId, Long taskId, Integer currentRevision, Integer nextRevision) {
            }

            @Override
            public TaskSubmissionAttachment findSubmission(String tenantId, Long submissionId, Long attachmentId) {
                TaskSubmissionAttachment attachment = new TaskSubmissionAttachment();
                attachment.setId(attachmentId); attachment.setTenantId(tenantId); attachment.setSubmissionId(submissionId);
                attachment.setFieldKey("evidence"); attachment.setFileName("evidence.pdf");
                attachment.setFileType("application/pdf"); attachment.setSizeBytes(3L); attachment.setSensitive(true);
                return attachment;
            }

            @Override
            public SubmissionAttachmentContent downloadSubmission(String tenantId, Long submissionId, Long attachmentId) {
                attachmentDownloads.incrementAndGet();
                return new SubmissionAttachmentContent("evidence", "evidence.pdf", "application/pdf", 3L, true,
                    new java.io.ByteArrayInputStream(new byte[]{1, 2, 3}));
            }
        };
        service = new TaskRuntimeService(taskMapper, draftMapper, submissionMapper, submissionAttachmentMapper,
            referenceMapper, participantMapper, eventMapper, factMapper, templateService,
            new TemplateFormRuntime(new FieldTypeRegistry(), new ExpressionEngine()), visibilityService,
            attachmentService, notificationOutbox, metricService, new TaskAggregateReferenceService(metricService), userMapper,
            new ObjectMapper().findAndRegisterModules(),
            approvalApplication, auditLogMapper, eventPublisher);
        user = new SecurityUser(9L, "operator", "", "tenant-a", 3L, "group",
            Set.of("task:read", "task:update", "task:submit"));
    }

    @Test
    void staleDraftRevisionHasZeroWrites() {
        TaskInstance task = task("in_progress", 3);
        when(taskMapper.lockById("tenant-a", 1L)).thenReturn(task);

        assertThatThrownBy(() -> service.saveDraft(user, 1L, new SaveTaskDraftRequest(2, Map.of("summary", "old"))))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode()).isEqualTo("TASK_DRAFT_REVISION_CONFLICT"));

        verify(draftMapper, never()).insert(any(TaskDraft.class));
        verify(taskMapper, never()).updateById(any(TaskInstance.class));
    }

    @Test
    void invalidSubmissionHasZeroWrites() {
        TaskInstance task = task("in_progress", 1);
        TaskDraft draft = new TaskDraft();
        draft.setId(2L); draft.setTenantId("tenant-a"); draft.setTaskId(1L); draft.setRevision(1); draft.setFormData(Map.of());
        TaskFieldDefinition required = new TaskFieldDefinition();
        required.setKey("summary"); required.setLabel("总结"); required.setType("textarea"); required.setRequired(true);
        when(taskMapper.lockById("tenant-a", 1L)).thenReturn(task);
        when(submissionMapper.findByIdempotencyKey("tenant-a", 1L, "key-1")).thenReturn(null);
        when(draftMapper.findLatest("tenant-a", 1L)).thenReturn(draft);
        when(templateService.getVersion("tenant-a", 7L)).thenReturn(template(required));

        assertThatThrownBy(() -> service.submit(user, 1L, new CreateTaskSubmissionRequest(1, "key-1")))
            .isInstanceOf(TaskTemplateException.class)
            .satisfies(error -> assertThat(((TaskTemplateException) error).getErrorCode()).isEqualTo("TASK_SUBMISSION_INVALID"));

        verify(submissionMapper, never()).insert(any(TaskSubmission.class));
        verify(taskMapper, never()).updateById(any(TaskInstance.class));
    }

    @Test
    void repeatedIdempotencyKeyReturnsExistingSubmissionBeforeStatusGate() {
        TaskInstance completed = task("completed", 1);
        TaskSubmission existing = new TaskSubmission();
        existing.setId(55L); existing.setTenantId("tenant-a"); existing.setTaskId(1L); existing.setVersion(1);
        existing.setSubmittedBy(9L); existing.setStatus("approved");
        when(taskMapper.lockById("tenant-a", 1L)).thenReturn(completed);
        when(submissionMapper.findByIdempotencyKey("tenant-a", 1L, "same-key")).thenReturn(existing);
        when(approvalApplication.findRoundId("tenant-a", 55L)).thenReturn(null);

        var result = service.submit(user, 1L, new CreateTaskSubmissionRequest(1, "same-key"));

        assertThat(result.submissionId()).isEqualTo(55L);
        assertThat(actionCalls).hasValue(0);
        verify(submissionMapper, never()).insert(any(TaskSubmission.class));
    }

    @Test
    void reassignUpdatesAssigneeOrganizationSnapshot() {
        TaskInstance task = task("in_progress", 1);
        task.setTitle("转派测试任务");
        task.setGroupId(3L);
        task.setOrganizationSnapshot(Map.of(
            "userId", 9L, "realName", "旧执行人", "groupId", 3L, "groupName", "原组"));
        com.cwgsyw.platform.module.user.entity.User assignee = new com.cwgsyw.platform.module.user.entity.User();
        assignee.setId(12L); assignee.setTenantId("tenant-a"); assignee.setUsername("new-user");
        assignee.setRealName("新执行人"); assignee.setGroupId(5L); assignee.setStatus(1); assignee.setIsDeleted(false);
        when(taskMapper.lockById("tenant-a", 1L)).thenReturn(task);
        when(userMapper.selectOne(any())).thenReturn(assignee);
        when(templateService.getVersion("tenant-a", 7L)).thenReturn(template(field("evidence", false)));

        service.reassign(user, 1L, new ReassignTaskRequest(12L, null, "交接"));

        assertThat(task.getAssigneeId()).isEqualTo(12L);
        assertThat(task.getGroupId()).isEqualTo(5L);
        assertThat(task.getOrganizationSnapshot())
            .containsEntry("userId", 12L)
            .containsEntry("username", "new-user")
            .containsEntry("realName", "新执行人")
            .containsEntry("groupId", 5L)
            .doesNotContainKey("groupName");
        verify(taskMapper).updateById(task);
    }

    @Test
    void resubmissionSupersedesPreviousVersionAndStartsNewApprovalRound() {
        TaskInstance task = task("changes_requested", 4);
        task.setBusinessDate(LocalDate.of(2026, 7, 24));
        task.setApprovalSchemeVersionId(8L);
        task.setApprovalStatus("changes_requested");
        task.setCurrentSubmissionId(55L);
        task.setCurrentApprovalRoundId(30L);
        TaskDraft draft = new TaskDraft();
        draft.setId(4L); draft.setTenantId("tenant-a"); draft.setTaskId(1L); draft.setRevision(4);
        draft.setFormData(Map.of("summary", "已补充恢复验证记录"));
        TaskSubmission previous = new TaskSubmission();
        previous.setId(55L); previous.setTenantId("tenant-a"); previous.setTaskId(1L); previous.setVersion(1);
        previous.setStatus("changes_requested"); previous.setEffective(false); previous.setSubmittedBy(9L);
        TaskFieldDefinition summary = new TaskFieldDefinition();
        summary.setKey("summary"); summary.setLabel("总结"); summary.setType("textarea"); summary.setRequired(true);
        summary.setAnalytics(Map.of("enabled", true, "role", List.of("dimension"), "aggregation", "count"));
        when(taskMapper.lockById("tenant-a", 1L)).thenReturn(task);
        when(submissionMapper.findByIdempotencyKey("tenant-a", 1L, "key-2")).thenReturn(null);
        when(draftMapper.findLatest("tenant-a", 1L)).thenReturn(draft);
        when(templateService.getVersion("tenant-a", 7L)).thenReturn(template(summary));
        when(submissionMapper.selectOne(any())).thenReturn(previous);
        doAnswer(invocation -> { ((TaskSubmission) invocation.getArgument(0)).setId(56L); return 1; })
            .when(submissionMapper).insert(any(TaskSubmission.class));
        when(approvalApplication.start(any(TaskInstance.class), any(TaskSubmission.class), any())).thenReturn(31L);

        var result = service.submit(user, 1L, new CreateTaskSubmissionRequest(4, "key-2"));

        assertThat(result.submissionId()).isEqualTo(56L);
        assertThat(result.version()).isEqualTo(2);
        assertThat(result.approvalRoundId()).isEqualTo(31L);
        assertThat(previous.getStatus()).isEqualTo("superseded");
        assertThat(previous.getEffective()).isFalse();
        ArgumentCaptor<TaskSubmission> submission = ArgumentCaptor.forClass(TaskSubmission.class);
        verify(submissionMapper).insert(submission.capture());
        assertThat(submission.getValue().getVersion()).isEqualTo(2);
        assertThat(submission.getValue().getSupersedesSubmissionId()).isEqualTo(55L);
        assertThat(submission.getValue().getStatus()).isEqualTo("pending_review");
        assertThat(submission.getValue().getEffective()).isFalse();
        assertThat(task.getCurrentSubmissionId()).isEqualTo(56L);
        assertThat(task.getCurrentApprovalRoundId()).isEqualTo(31L);
        assertThat(task.getExecutionStatus()).isEqualTo("submitted");
        assertThat(task.getApprovalStatus()).isEqualTo("in_review");
        ArgumentCaptor<TaskFieldFact> fact = ArgumentCaptor.forClass(TaskFieldFact.class);
        verify(factMapper).insert(fact.capture());
        assertThat(fact.getValue().getDimensionSnapshot()).containsEntry("businessDate", "2026-07-24");
        verify(approvalApplication).start(task, submission.getValue(), 9L);
    }

    @Test
    void submissionReplacesAggregateReferenceAndFreezesMetricLineage() {
        TaskInstance task = task("in_progress", 1);
        task.setGroupId(12L);
        TaskDraft draft = new TaskDraft();
        draft.setId(2L); draft.setTenantId("tenant-a"); draft.setTaskId(1L); draft.setRevision(1);
        draft.setFormData(Map.of("weekly_total", 999));
        TaskFieldDefinition total = aggregateField("weekly_total");
        when(taskMapper.lockById("tenant-a", 1L)).thenReturn(task);
        when(submissionMapper.findByIdempotencyKey("tenant-a", 1L, "aggregate-key")).thenReturn(null);
        when(draftMapper.findLatest("tenant-a", 1L)).thenReturn(draft);
        when(templateService.getVersion("tenant-a", 7L)).thenReturn(template(total));
        when(metricService.preview(any(), org.mockito.ArgumentMatchers.eq(81L), any())).thenReturn(
            new com.cwgsyw.platform.module.task.metric.dto.MetricPreviewVO(81L,
                LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 7), new BigDecimal("42"),
                new BigDecimal("45"), new BigDecimal("3"), "manual_report", 2,
                List.of(901L, 902L), List.of(11L, 12L), List.of(101L, 102L)));
        doAnswer(invocation -> { ((TaskSubmission) invocation.getArgument(0)).setId(56L); return 1; })
            .when(submissionMapper).insert(any(TaskSubmission.class));

        assertThatThrownBy(() -> service.submit(user, 1L, new CreateTaskSubmissionRequest(1, "aggregate-key")))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("TASK_AGGREGATE_REFERENCE_READ_ONLY"));

        draft.setFormData(Map.of());
        var result = service.submit(user, 1L, new CreateTaskSubmissionRequest(1, "aggregate-key"));

        assertThat(result.submissionId()).isEqualTo(56L);
        ArgumentCaptor<TaskSubmission> submission = ArgumentCaptor.forClass(TaskSubmission.class);
        ArgumentCaptor<com.cwgsyw.platform.module.task.runtime.entity.TaskSubmissionReference> reference =
            ArgumentCaptor.forClass(com.cwgsyw.platform.module.task.runtime.entity.TaskSubmissionReference.class);
        verify(submissionMapper).insert(submission.capture());
        verify(referenceMapper).insert(reference.capture());
        assertThat(submission.getValue().getFormData()).containsEntry("weekly_total", new BigDecimal("45"));
        assertThat(reference.getValue().getRefType()).isEqualTo("aggregate_reference");
        assertThat(reference.getValue().getRefKey()).isEqualTo("81");
        assertThat(reference.getValue().getRefSnapshot()).containsEntry("selectedValue", new BigDecimal("45"))
            .containsEntry("taskIds", List.of(11L, 12L)).containsEntry("submissionIds", List.of(101L, 102L));
    }

    @Test
    void submissionExtractsEnabledTableColumnFactsWithStableRowKeys() {
        TaskInstance task = task("in_progress", 1);
        task.setBusinessDate(LocalDate.of(2026, 7, 25));
        TaskDraft draft = new TaskDraft();
        draft.setId(2L); draft.setTenantId("tenant-a"); draft.setTaskId(1L); draft.setRevision(1);
        draft.setFormData(Map.of("weekly_items", List.of(
            Map.of("__rowId", "abcdefgh12345678", "hours", 2.5, "note", "已完成"))));
        TaskFieldDefinition table = new TaskFieldDefinition();
        table.setKey("weekly_items"); table.setLabel("本周事项"); table.setType("table");
        table.setAnalytics(Map.of("enabled", false));
        table.setValidation(Map.of("columns", List.of(
            Map.of("key", "hours", "label", "工时", "type", "number", "analyticsEnabled", true),
            Map.of("key", "note", "label", "备注", "type", "text", "analyticsEnabled", false))));
        when(taskMapper.lockById("tenant-a", 1L)).thenReturn(task);
        when(submissionMapper.findByIdempotencyKey("tenant-a", 1L, "table-key")).thenReturn(null);
        when(draftMapper.findLatest("tenant-a", 1L)).thenReturn(draft);
        when(templateService.getVersion("tenant-a", 7L)).thenReturn(template(table));
        doAnswer(invocation -> { ((TaskSubmission) invocation.getArgument(0)).setId(56L); return 1; })
            .when(submissionMapper).insert(any(TaskSubmission.class));

        service.submit(user, 1L, new CreateTaskSubmissionRequest(1, "table-key"));

        ArgumentCaptor<TaskFieldFact> fact = ArgumentCaptor.forClass(TaskFieldFact.class);
        verify(factMapper).insert(fact.capture());
        assertThat(fact.getValue().getFieldKey()).isEqualTo("weekly_items");
        assertThat(fact.getValue().getSubFieldKey()).isEqualTo("hours");
        assertThat(fact.getValue().getRowKey()).isEqualTo("abcdefgh12345678");
        assertThat(fact.getValue().getValueNumber()).isEqualByComparingTo("2.5");
    }

    @Test
    void submissionKeepsTableLevelAnalyticsCompatibilityForColumnFacts() {
        TaskInstance task = task("in_progress", 1);
        TaskDraft draft = new TaskDraft();
        draft.setId(2L); draft.setTenantId("tenant-a"); draft.setTaskId(1L); draft.setRevision(1);
        draft.setFormData(Map.of("weekly_items", List.of(
            Map.of("__rowId", "abcdefgh12345678", "hours", 2.5))));
        TaskFieldDefinition table = new TaskFieldDefinition();
        table.setKey("weekly_items"); table.setLabel("本周事项"); table.setType("table");
        table.setAnalytics(Map.of("enabled", true));
        table.setValidation(Map.of("columns", List.of(
            Map.of("key", "hours", "label", "工时", "type", "number"))));
        when(taskMapper.lockById("tenant-a", 1L)).thenReturn(task);
        when(submissionMapper.findByIdempotencyKey("tenant-a", 1L, "table-compat-key")).thenReturn(null);
        when(draftMapper.findLatest("tenant-a", 1L)).thenReturn(draft);
        when(templateService.getVersion("tenant-a", 7L)).thenReturn(template(table));
        doAnswer(invocation -> { ((TaskSubmission) invocation.getArgument(0)).setId(57L); return 1; })
            .when(submissionMapper).insert(any(TaskSubmission.class));

        service.submit(user, 1L, new CreateTaskSubmissionRequest(1, "table-compat-key"));

        ArgumentCaptor<TaskFieldFact> fact = ArgumentCaptor.forClass(TaskFieldFact.class);
        verify(factMapper).insert(fact.capture());
        assertThat(fact.getValue().getSubFieldKey()).isEqualTo("hours");
    }

    @Test
    void rejectsAttachmentForRowMissingFromCurrentDraft() {
        TaskInstance task = task("in_progress", 1);
        TaskDraft draft = new TaskDraft();
        draft.setTenantId("tenant-a"); draft.setTaskId(1L); draft.setRevision(1);
        draft.setFormData(Map.of("weekly_items", List.of(Map.of("__rowId", "abcdefgh12345678"))));
        when(taskMapper.lockById("tenant-a", 1L)).thenReturn(task);
        when(draftMapper.findLatest("tenant-a", 1L)).thenReturn(draft);

        assertThatThrownBy(() -> service.uploadAttachment(user, 1L, 1,
            "weekly_items~abcdefgh87654321~evidence",
            new org.springframework.mock.web.MockMultipartFile("file", "evidence.txt", "text/plain", new byte[] {1})))
            .hasMessageContaining("附件行不存在");
        verify(draftMapper).findLatest("tenant-a", 1L);
    }

    @Test
    void sensitiveAttachmentIsAuthorizedBeforeStorageAndAuditedAfterDownload() {
        TaskInstance task = task("completed", 1);
        TaskSubmission submission = submission(55L, 1L);
        TaskFieldDefinition evidence = field("evidence", false);
        when(taskMapper.selectOne(any())).thenReturn(task);
        when(submissionMapper.selectOne(any())).thenReturn(submission);
        when(templateService.getVersion("tenant-a", 7L)).thenReturn(template(evidence));

        var content = service.downloadSubmissionAttachment(user, 1L, 55L, 77L);

        assertThat(content.sensitive()).isTrue();
        assertThat(attachmentDownloads).hasValue(1);
        verify(auditLogMapper).insert(org.mockito.ArgumentMatchers.<com.cwgsyw.platform.common.entity.AuditLog>argThat(log ->
            "attachment_download".equals(log.getAction()) && "task_submission_attachment".equals(log.getTargetType())
                && log.getTargetId().equals(77L) && log.getAfterJson() == null));
    }

    @Test
    void hiddenAttachmentDoesNotTouchObjectStorageOrAudit() {
        TaskInstance task = task("completed", 1);
        TaskSubmission submission = submission(55L, 1L);
        when(taskMapper.selectOne(any())).thenReturn(task);
        when(submissionMapper.selectOne(any())).thenReturn(submission);
        when(templateService.getVersion("tenant-a", 7L)).thenReturn(template(field("other", false)));

        assertThatThrownBy(() -> service.downloadSubmissionAttachment(user, 1L, 55L, 77L))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode()).isEqualTo("TASK_ATTACHMENT_FIELD_HIDDEN"));

        assertThat(attachmentDownloads).hasValue(0);
        verify(auditLogMapper, never()).insert(any(com.cwgsyw.platform.common.entity.AuditLog.class));
    }

    private TaskInstance task(String status, int revision) {
        TaskInstance task = new TaskInstance();
        task.setId(1L); task.setTenantId("tenant-a"); task.setTemplateVersionId(7L); task.setAssigneeId(9L);
        task.setExecutionStatus(status); task.setCurrentDraftRevision(revision); task.setLockVersion(0); task.setIsDeleted(false);
        return task;
    }

    private TaskActionsVO actions(boolean edit, boolean submit) {
        return new TaskActionsVO(false, edit, submit, false, true, false, true);
    }

    private TaskSubmission submission(Long id, Long taskId) {
        TaskSubmission submission = new TaskSubmission();
        submission.setId(id); submission.setTenantId("tenant-a"); submission.setTaskId(taskId);
        submission.setTemplateVersionId(7L); submission.setVersion(1); submission.setSubmittedBy(9L);
        return submission;
    }

    private TaskFieldDefinition field(String key, boolean sensitive) {
        TaskFieldDefinition field = new TaskFieldDefinition();
        field.setKey(key); field.setLabel(key); field.setType("file"); field.setSensitive(sensitive);
        return field;
    }

    private TaskFieldDefinition aggregateField(String key) {
        TaskFieldDefinition field = new TaskFieldDefinition();
        field.setKey(key); field.setLabel(key); field.setType("aggregate_reference");
        field.setValidation(Map.of("aggregate", Map.of("metricId", 81L, "from", "2026-07-01", "to", "2026-07-07")));
        field.setAnalytics(Map.of("enabled", true, "aggregation", "sum"));
        return field;
    }

    private TaskTemplateVersionVO template(TaskFieldDefinition field) {
        return TaskTemplateVersionVO.builder().id(7L).templateId(1L).version(1).status("published")
            .name("测试模板").layout(Map.of()).completionPolicy(Map.of()).defaultAssignment(Map.of())
            .defaultReminder(Map.of()).fields(List.of(field)).build();
    }
}
