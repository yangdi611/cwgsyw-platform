package com.cwgsyw.platform.module.task.analytics;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.cwgsyw.platform.module.approval.entity.ApprovalRound;
import com.cwgsyw.platform.module.approval.mapper.ApprovalRoundMapper;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsQueryRequest;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsQueryResponse;
import com.cwgsyw.platform.module.task.analytics.service.AnalyticsQueryValidator;
import com.cwgsyw.platform.module.task.analytics.service.TaskAnalyticsQueryService;
import com.cwgsyw.platform.module.task.runtime.entity.TaskFieldFact;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.entity.TaskParticipant;
import com.cwgsyw.platform.module.task.runtime.entity.TaskSubmission;
import com.cwgsyw.platform.module.task.runtime.entity.TaskSubmissionAttachment;
import com.cwgsyw.platform.module.task.runtime.entity.TaskSubmissionReference;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskFieldFactMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskInstanceMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskParticipantMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskSubmissionAttachmentMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskSubmissionMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskSubmissionReferenceMapper;
import com.cwgsyw.platform.module.task.runtime.service.TaskVisibilityService;
import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateVersionVO;
import com.cwgsyw.platform.module.task.template.form.FieldTypeRegistry;
import com.cwgsyw.platform.module.task.template.service.TaskTemplateService;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskAnalyticsQueryServiceTest {
    @Mock TaskFieldFactMapper factMapper;
    @Mock TaskInstanceMapper taskMapper;
    @Mock TaskSubmissionMapper submissionMapper;
    @Mock TaskSubmissionAttachmentMapper attachmentMapper;
    @Mock TaskSubmissionReferenceMapper referenceMapper;
    @Mock TaskParticipantMapper participantMapper;
    @Mock ApprovalRoundMapper approvalRoundMapper;
    @Mock TaskTemplateService templateService;
    @Mock TaskVisibilityService visibilityService;

    private TaskAnalyticsQueryService service;
    private SecurityUser user;
    private TaskTemplateVersionVO template;
    private List<TaskFieldFact> facts;
    private List<TaskInstance> tasks;
    private List<TaskSubmission> submissions;

    @BeforeEach
    void setUp() {
        user = new SecurityUser(10L, "operator", "", "tenant-a", 20L, "tenant",
            Set.of("task_analytics:read"));
        template = template();
        tasks = List.of(task(1L, "approved", 20L, LocalDate.of(2026, 7, 1)),
            task(2L, "changes_requested", 20L, LocalDate.of(2026, 7, 2)));
        submissions = List.of(submission(100L, 1L, 10L, 1), submission(101L, 2L, 11L, 1));
        facts = List.of(
            fact(1000L, 100L, 1L, "work_hours", "number", number("2"), null, null),
            fact(1001L, 101L, 2L, "work_hours", "number", number("3"), null, null),
            fact(1002L, 100L, 1L, "score", "number", number("2"), null, null),
            fact(1003L, 101L, 2L, "score", "number", number("4"), null, null),
            fact(1004L, 100L, 1L, "weight", "number", number("1"), null, null),
            fact(1005L, 101L, 2L, "weight", "number", number("3"), null, null),
            fact(1006L, 100L, 1L, "passed", "number", number("1"), null, null),
            fact(1007L, 101L, 2L, "passed", "number", number("2"), null, null),
            fact(1008L, 100L, 1L, "total", "number", number("2"), null, null),
            fact(1009L, 101L, 2L, "total", "number", number("4"), null, null),
            fact(1010L, 100L, 1L, "result", "single_select", null, "ok", null),
            fact(1011L, 101L, 2L, "result", "single_select", null, "fail", null),
            fact(1012L, 100L, 1L, "labels", "multi_select", null, "mysql", null),
            fact(1013L, 100L, 1L, "labels", "multi_select", null, "postgres", null),
            fact(1014L, 101L, 2L, "labels", "multi_select", null, "mysql", null),
            fact(1015L, 100L, 1L, "checks", "table", number("1"), null, "duration"),
            fact(1016L, 100L, 1L, "checks", "table", number("2"), null, "duration"));

        when(templateService.getVersion("tenant-a", 7L)).thenReturn(template);
        lenient().when(factMapper.selectList(any())).thenReturn(facts);
        lenient().when(taskMapper.selectList(any())).thenReturn(tasks);
        lenient().when(submissionMapper.selectList(any())).thenReturn(submissions);
        lenient().when(participantMapper.selectList(any())).thenReturn(List.<TaskParticipant>of());
        lenient().when(referenceMapper.selectList(any())).thenReturn(List.<TaskSubmissionReference>of());
        lenient().when(approvalRoundMapper.selectList(any())).thenReturn(List.<ApprovalRound>of());
        lenient().when(attachmentMapper.selectList(any())).thenReturn(List.<TaskSubmissionAttachment>of());
        lenient().when(visibilityService.isTenantScope(user)).thenReturn(true);
        service = new TaskAnalyticsQueryService(factMapper, taskMapper, submissionMapper, attachmentMapper,
            referenceMapper, participantMapper, approvalRoundMapper, templateService, visibilityService,
            new FieldTypeRegistry(), new AnalyticsQueryValidator());
    }

    @Test
    void aggregatesNumericMetricsAndWeightedAverageAndRatio() {
        AnalyticsQueryResponse response = service.query(user, requestWithPolicy(
            List.of(metric("work_hours", "sum", "hours"), metric("work_hours", "avg", "avgHours"),
                metric("work_hours", "min", "minHours"), metric("work_hours", "max", "maxHours"),
                new AnalyticsQueryRequest.Metric("score", null, "weighted_avg", "weightedScore", null, null, "weight"),
                new AnalyticsQueryRequest.Metric(null, null, "ratio", "passRate", "passed", "total", null)),
            List.of(), "aggregate", null, "current_effective"));

        assertThat(response.rows()).hasSize(1);
        assertThat(response.rows().getFirst()).satisfies(row -> {
            assertThat(row).containsEntry("hours", number("5"));
            assertThat(row).containsEntry("avgHours", number("2.5000"));
            assertThat(row).containsEntry("minHours", number("2"));
            assertThat(row).containsEntry("maxHours", number("3"));
            assertThat(row).containsEntry("weightedScore", number("3.5000"));
            assertThat(row).containsEntry("passRate", number("0.5000"));
        });
    }

    @Test
    void returnsChineseLabelsForSystemDimensionsMetricsAndFormFields() {
        AnalyticsQueryResponse aggregate = service.query(user, requestWithPolicy(
            List.of(metric("work_hours", "sum", "hours")), List.of("business_date"),
            "aggregate", null, "current_effective"));

        assertThat(aggregate.columnLabels())
            .containsEntry("business_date", "业务日期")
            .containsEntry("hours", "工时（合计）");

        AnalyticsQueryResponse detail = service.query(user, requestWithPolicy(
            List.of(), List.of(), "text_list", List.of("result"), "current_effective"));

        assertThat(detail.columnLabels())
            .containsEntry("taskId", "任务ID")
            .containsEntry("submissionVersion", "提交版本")
            .containsEntry("result", "结果");
    }

    @Test
    void exposesSnapshotNamesAndFieldLabelsWhileKeepingTraceIdsInternal() {
        AnalyticsQueryResponse response = service.query(user, requestWithPolicy(
            List.of(), List.of(), "text_list", List.of("result"), "current_effective"));

        assertThat(response.columns())
            .contains("assignee", "ownerGroup", "fields", "result")
            .doesNotContain("assigneeId", "groupId", "fieldFactIds");
        assertThat(response.columnLabels())
            .containsEntry("assignee", "执行人")
            .containsEntry("ownerGroup", "执行组")
            .containsEntry("fields", "字段");
        assertThat(response.rows()).allSatisfy(row -> {
            assertThat(row).containsEntry("assignee", "执行人").containsEntry("ownerGroup", "数据库组");
            assertThat(row).containsKeys("assigneeId", "groupId", "fieldFactIds");
            assertThat(row.get("fields")).asList().containsExactly("结果");
        });

        AnalyticsQueryResponse multipleFields = service.query(user, requestWithPolicy(
            List.of(), List.of(), "text_list", List.of("work_hours", "result"), "current_effective"));
        assertThat(multipleFields.rows()).allSatisfy(row ->
            assertThat(row.get("fields")).asList().containsExactly("工时", "结果"));
    }

    @Test
    void displaysLegacyGroupLeaderNameInDetailsAndAssigneeDimension() {
        TaskInstance leaderTask = task(1L, "approved", 20L, LocalDate.of(2026, 7, 1));
        leaderTask.setAssigneeId(110L);
        leaderTask.setOrganizationSnapshot(Map.of(
            "groupId", 20L, "groupName", "数据库组", "leaderId", 110L, "leaderName", "负责人"));
        tasks = List.of(leaderTask, task(2L, "changes_requested", 20L, LocalDate.of(2026, 7, 2)));
        when(taskMapper.selectList(any())).thenReturn(tasks);

        AnalyticsQueryResponse details = service.query(user, requestWithPolicy(
            List.of(), List.of(), "text_list", List.of("result"), "current_effective"));
        AnalyticsQueryResponse grouped = service.query(user, requestWithPolicy(
            List.of(metric("work_hours", "sum", "hours")), List.of("assignee"),
            "aggregate", null, "current_effective"));
        AnalyticsQueryRequest base = requestWithPolicy(List.of(metric("work_hours", "sum", "hours")),
            List.of("assignee"), "aggregate", null, "current_effective");
        AnalyticsQueryResponse filteredById = service.query(user, new AnalyticsQueryRequest(
            base.source(), base.time(), base.metrics(), base.dimensions(),
            List.of(new AnalyticsQueryRequest.Filter("assignee", "eq", 110L)), base.effectivePolicy(),
            base.orderBy(), base.limit(), base.output(), base.detailFields(), base.textSearch()));

        assertThat(details.rows()).anySatisfy(row -> assertThat(row).containsEntry("assignee", "负责人"));
        assertThat(grouped.rows()).anySatisfy(row -> assertThat(row)
            .containsEntry("assignee", "负责人").containsEntry("hours", number("2")));
        assertThat(filteredById.rows()).singleElement().satisfies(row -> assertThat(row)
            .containsEntry("assignee", "负责人").containsEntry("hours", number("2")));
    }

    @Test
    void displaysAssigneeAndGroupNamesFromSharedTaskSnapshot() {
        TaskInstance sharedTask = task(1L, "approved", 20L, LocalDate.of(2026, 7, 1));
        sharedTask.setAssigneeId(110L);
        sharedTask.setOrganizationSnapshot(Map.of(
            "users", List.of(Map.of("userId", 110L, "realName", "共享执行人", "groupId", 20L, "groupName", "数据库组")),
            "groups", List.of(Map.of("groupId", 20L, "groupName", "数据库组", "leaderId", 110L, "leaderName", "共享执行人"))));
        tasks = List.of(sharedTask, task(2L, "changes_requested", 20L, LocalDate.of(2026, 7, 2)));
        when(taskMapper.selectList(any())).thenReturn(tasks);

        AnalyticsQueryResponse details = service.query(user, requestWithPolicy(
            List.of(), List.of(), "text_list", List.of("result"), "current_effective"));

        assertThat(details.rows()).anySatisfy(row -> assertThat(row)
            .containsEntry("assignee", "共享执行人").containsEntry("ownerGroup", "数据库组"));
    }

    @Test
    void groupsChoiceAndMultiSelectFactsAndSupportsTableColumnDrilldown() {
        AnalyticsQueryResponse categories = service.query(user, requestWithPolicy(
            List.of(new AnalyticsQueryRequest.Metric("result", null, "count", "count", null, null, null)),
            List.of("result"), "aggregate", null, "current_effective"));
        assertThat(categories.rows()).extracting(row -> row.get("result")).containsExactlyInAnyOrder("ok", "fail");
        assertThat(categories.rows()).allSatisfy(row -> assertThat(row.get("count")).isEqualTo(1L));

        AnalyticsQueryResponse labels = service.query(user, requestWithPolicy(
            List.of(new AnalyticsQueryRequest.Metric("labels", null, "count", "count", null, null, null)),
            List.of("labels"), "aggregate", null, "current_effective"));
        assertThat(labels.rows()).anySatisfy(row -> {
            assertThat(row).containsEntry("labels", "mysql");
            assertThat(row).containsEntry("count", 2L);
        }).anySatisfy(row -> {
            assertThat(row).containsEntry("labels", "postgres");
            assertThat(row).containsEntry("count", 1L);
        });

        AnalyticsQueryResponse table = service.query(user, request(
            List.of(new AnalyticsQueryRequest.Metric("checks", "duration", "sum", "totalDuration", null, null, null)),
            List.of(), "aggregate", null));
        assertThat(table.rows()).hasSize(1);
        assertThat(table.rows().getFirst()).containsEntry("totalDuration", number("3"));

        AnalyticsQueryResponse text = service.query(user, requestWithPolicy(
            List.of(), List.of(), "text_list", List.of("labels"), "current_effective"));
        assertThat(text.rows()).hasSize(2);
    }

    @Test
    void exposesOnlyEnabledTableColumnsWithoutRequiringTableLevelAnalytics() {
        TaskFieldDefinition table = field("work_items", "工作明细", "table");
        table.setAnalytics(Map.of("enabled", false));
        table.setValidation(Map.of("columns", List.of(
            Map.of("key", "hours", "label", "工时", "type", "number", "analyticsEnabled", true, "summary", "sum"),
            Map.of("key", "note", "label", "备注", "type", "text", "analyticsEnabled", false))));
        template = TaskTemplateVersionVO.builder().id(7L).templateId(1L).version(1).status("published")
            .name("统计测试模板").fields(List.of(table)).build();
        when(templateService.getVersion("tenant-a", 7L)).thenReturn(template);

        var fields = service.fields(user, 7L);

        assertThat(fields).extracting(value -> value.key()).containsExactly("work_items.hours");
        assertThat(fields.getFirst()).extracting(value -> value.label(), value -> value.defaultAggregation())
            .containsExactly("工作明细 · 工时", "sum");
    }

    @Test
    void preservesTableLevelAnalyticsForExistingTemplates() {
        TaskFieldDefinition table = field("work_items", "工作明细", "table");
        table.setAnalytics(Map.of("enabled", true, "aggregation", "sum"));
        table.setValidation(Map.of("columns", List.of(
            Map.of("key", "hours", "label", "工时", "type", "number"),
            Map.of("key", "note", "label", "备注", "type", "text"))));
        template = TaskTemplateVersionVO.builder().id(7L).templateId(1L).version(1).status("published")
            .name("统计测试模板").fields(List.of(table)).build();
        when(templateService.getVersion("tenant-a", 7L)).thenReturn(template);

        assertThat(service.fields(user, 7L)).extracting(value -> value.key())
            .containsExactly("work_items.hours", "work_items.note");
    }

    @Test
    void rejectsDisabledTableColumnInDetailFields() {
        TaskFieldDefinition table = field("work_items", "工作明细", "table");
        table.setAnalytics(Map.of("enabled", false));
        table.setValidation(Map.of("columns", List.of(
            Map.of("key", "hours", "label", "工时", "type", "number", "analyticsEnabled", true),
            Map.of("key", "note", "label", "备注", "type", "text", "analyticsEnabled", false))));
        template = TaskTemplateVersionVO.builder().id(7L).templateId(1L).version(1).status("published")
            .name("统计测试模板").fields(List.of(table)).build();
        when(templateService.getVersion("tenant-a", 7L)).thenReturn(template);

        assertThatThrownBy(() -> service.query(user, request(List.of(), List.of(), "detail", List.of("work_items.note"))))
            .hasMessageContaining("表格列未启用统计");
    }

    @Test
    void excludesChangesRequestedTasksByDefaultAndReturnsAttachmentMetadata() {
        AnalyticsQueryResponse approved = service.query(user, request(
            List.of(metric("work_hours", "sum", "hours")), List.of(), "aggregate", null));
        assertThat(approved.rows()).hasSize(1);
        assertThat(approved.rows().getFirst()).containsEntry("hours", number("2"));

        TaskSubmissionAttachment attachment = new TaskSubmissionAttachment();
        attachment.setId(77L); attachment.setTenantId("tenant-a"); attachment.setSubmissionId(100L);
        attachment.setFieldKey("attachments"); attachment.setFileName("evidence.png");
        attachment.setFileType("image/png"); attachment.setSizeBytes(12L); attachment.setSensitive(false);
        when(attachmentMapper.selectList(any())).thenReturn(List.of(attachment));
        AnalyticsQueryResponse files = service.query(user, request(List.of(), List.of(), "image_gallery", List.of("attachments")));
        assertThat(files.rows()).hasSize(1);
        assertThat(files.rows().getFirst()).satisfies(row -> {
            assertThat(row).containsEntry("fileName", "evidence.png");
            assertThat(row.get("downloadPath")).isEqualTo("/api/tasks/1/submissions/100/attachments/77/download");
        });
    }

    @Test
    void rejectsMultipleTemplatesAndOversizedRange() {
        AnalyticsQueryRequest base = request(List.of(metric("work_hours", "sum", "hours")), List.of(), "aggregate", null);
        assertThatThrownBy(() -> service.query(user, new AnalyticsQueryRequest(
            new AnalyticsQueryRequest.Source(List.of(7L, 8L)), base.time(), base.metrics(), base.dimensions(),
            base.filters(), base.effectivePolicy(), base.orderBy(), base.limit(), base.output(), base.detailFields(), base.textSearch())))
            .hasMessageContaining("只能选择一个模板版本");
        assertThatThrownBy(() -> service.query(user, new AnalyticsQueryRequest(
            base.source(), new AnalyticsQueryRequest.TimeRange("business_date", LocalDate.of(2020, 1, 1), LocalDate.of(2022, 1, 2), "day"),
            base.metrics(), base.dimensions(), base.filters(), base.effectivePolicy(), base.orderBy(), base.limit(), base.output(), base.detailFields(), base.textSearch())))
            .hasMessageContaining("730 天");
    }

    @Test
    void usesIsoWeekBasedYearAtCalendarYearBoundary() {
        tasks = List.of(task(1L, "approved", 20L, LocalDate.of(2021, 1, 1)),
            task(2L, "changes_requested", 20L, LocalDate.of(2021, 1, 2)));
        when(taskMapper.selectList(any())).thenReturn(tasks);
        AnalyticsQueryRequest query = new AnalyticsQueryRequest(new AnalyticsQueryRequest.Source(List.of(7L)),
            new AnalyticsQueryRequest.TimeRange("business_date", LocalDate.of(2020, 12, 28), LocalDate.of(2021, 1, 3), "week"),
            List.of(metric("work_hours", "sum", "hours")), List.of("business_date"), List.of(),
            "current_effective", List.of(), 100, "aggregate", null, null);

        AnalyticsQueryResponse response = service.query(user, query);

        assertThat(response.rows()).singleElement().satisfies(row -> {
            assertThat(row).containsEntry("business_date", "2020-W53");
            assertThat(row).containsEntry("hours", number("5"));
        });
    }

    private AnalyticsQueryRequest request(List<AnalyticsQueryRequest.Metric> metrics, List<String> dimensions,
                                          String output, List<String> detailFields) {
        return requestWithPolicy(metrics, dimensions, output, detailFields, "approved_or_no_approval");
    }

    private AnalyticsQueryRequest requestWithPolicy(List<AnalyticsQueryRequest.Metric> metrics, List<String> dimensions,
                                                    String output, List<String> detailFields, String policy) {
        return new AnalyticsQueryRequest(new AnalyticsQueryRequest.Source(List.of(7L)),
            new AnalyticsQueryRequest.TimeRange("business_date", LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31), "day"),
            metrics, dimensions, List.of(), policy, List.of(), 100, output, detailFields, null);
    }

    private AnalyticsQueryRequest.Metric metric(String field, String aggregation, String alias) {
        return new AnalyticsQueryRequest.Metric(field, null, aggregation, alias, null, null, null);
    }

    private TaskTemplateVersionVO template() {
        return TaskTemplateVersionVO.builder().id(7L).templateId(1L).version(1).status("published").name("统计测试模板")
            .fields(List.of(field("work_hours", "工时", "number"), field("score", "得分", "number"),
                field("weight", "权重", "number"), field("passed", "通过数", "number"), field("total", "总数", "number"),
                field("result", "结果", "single_select"), field("labels", "标签", "multi_select"), field("checks", "检查表", "table"),
                field("attachments", "附件", "file"))).build();
    }

    private TaskFieldDefinition field(String key, String label, String type) {
        TaskFieldDefinition field = new TaskFieldDefinition();
        field.setKey(key); field.setLabel(label); field.setType(type);
        field.setAnalytics(Map.of("enabled", true, "role", List.of("metric"), "aggregation", "sum"));
        if ("table".equals(type)) field.setValidation(Map.of("columns", List.of(Map.of("key", "duration", "type", "number", "analyticsEnabled", true))));
        return field;
    }

    private TaskInstance task(Long id, String approvalStatus, Long groupId, LocalDate date) {
        TaskInstance task = new TaskInstance();
        task.setId(id); task.setTenantId("tenant-a"); task.setTemplateVersionId(7L); task.setBusinessDate(date);
        task.setApprovalStatus(approvalStatus); task.setExecutionStatus("submitted"); task.setAssigneeId(10L);
        task.setGroupId(groupId); task.setIsDeleted(false); task.setOrganizationSnapshot(Map.of(
            "userId", 10L, "realName", "执行人", "groupId", groupId, "groupName", "数据库组"));
        task.setCiScopeSnapshot(Map.of("instances", List.of(Map.of("id", 900L, "modelCode", "mysql", "modelGroupCode", "database"))));
        return task;
    }

    private TaskSubmission submission(Long id, Long taskId, Long submitter, int version) {
        TaskSubmission submission = new TaskSubmission();
        submission.setId(id); submission.setTenantId("tenant-a"); submission.setTaskId(taskId); submission.setTemplateVersionId(7L);
        submission.setVersion(version); submission.setSubmittedBy(submitter); submission.setSubmittedAt(LocalDateTime.of(2026, 7, 3, 10, 0));
        submission.setEffective(true); submission.setStatus("current"); submission.setFormData(Map.of());
        return submission;
    }

    private TaskFieldFact fact(Long id, Long submissionId, Long taskId, String key, String type,
                               BigDecimal number, String text, String subFieldKey) {
        TaskFieldFact fact = new TaskFieldFact();
        fact.setId(id); fact.setTenantId("tenant-a"); fact.setSubmissionId(submissionId); fact.setTaskId(taskId);
        fact.setTemplateVersionId(7L); fact.setFieldKey(key); fact.setFieldType(type); fact.setValueNumber(number);
        fact.setValueText(text); fact.setSubFieldKey(subFieldKey); fact.setBusinessDate(taskId == 1L ? LocalDate.of(2026, 7, 1) : LocalDate.of(2026, 7, 2));
        fact.setIsActive(true); return fact;
    }

    private BigDecimal number(String value) { return new BigDecimal(value); }
}
