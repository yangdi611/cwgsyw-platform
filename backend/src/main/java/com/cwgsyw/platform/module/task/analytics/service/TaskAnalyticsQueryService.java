package com.cwgsyw.platform.module.task.analytics.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.approval.entity.ApprovalRound;
import com.cwgsyw.platform.module.approval.mapper.ApprovalRoundMapper;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsDrilldownRequest;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsDrilldownResponse;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsFieldMetadata;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsQueryRequest;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsQueryResponse;
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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskAnalyticsQueryService {
    private static final Set<String> INTERNAL_TRACE_COLUMNS = Set.of("assigneeId", "groupId", "fieldFactIds");
    private static final Map<String, String> SYSTEM_COLUMN_LABELS = Map.ofEntries(
        Map.entry("taskId", "任务ID"),
        Map.entry("taskTitle", "任务标题"),
        Map.entry("submissionId", "提交ID"),
        Map.entry("submissionVersion", "提交版本"),
        Map.entry("templateVersionId", "模板版本ID"),
        Map.entry("businessDate", "业务日期"),
        Map.entry("submittedAt", "提交时间"),
        Map.entry("assigneeId", "执行人ID"),
        Map.entry("groupId", "执行组ID"),
        Map.entry("fieldFactIds", "字段事实ID"),
        Map.entry("assignee", "执行人"),
        Map.entry("ownerGroup", "执行组"),
        Map.entry("fields", "字段"),
        Map.entry("attachmentId", "附件ID"),
        Map.entry("fieldKey", "表单字段"),
        Map.entry("fileName", "文件名"),
        Map.entry("contentType", "文件类型"),
        Map.entry("sizeBytes", "文件大小（字节）"),
        Map.entry("uploadedAt", "上传时间"),
        Map.entry("downloadPath", "下载地址")
    );
    private static final Map<String, String> DIMENSION_LABELS = Map.of(
        "business_date", "业务日期",
        "submitted_at", "提交时间",
        "assignee", "执行人",
        "submitter", "提交人",
        "owner_group", "执行时所属组",
        "template", "任务模板",
        "ci_model_group", "CI 模型组",
        "ci_model", "CI 模型",
        "ci_instance", "CI 实例"
    );
    private static final Map<String, String> AGGREGATION_LABELS = Map.of(
        "sum", "合计",
        "avg", "平均值",
        "min", "最小值",
        "max", "最大值",
        "count", "计数",
        "distinct_count", "去重计数",
        "weighted_avg", "加权平均值",
        "ratio", "比率"
    );

    private final TaskFieldFactMapper factMapper;
    private final TaskInstanceMapper taskMapper;
    private final TaskSubmissionMapper submissionMapper;
    private final TaskSubmissionAttachmentMapper attachmentMapper;
    private final TaskSubmissionReferenceMapper referenceMapper;
    private final TaskParticipantMapper participantMapper;
    private final ApprovalRoundMapper approvalRoundMapper;
    private final TaskTemplateService templateService;
    private final TaskVisibilityService visibilityService;
    private final FieldTypeRegistry fieldTypeRegistry;
    private final AnalyticsQueryValidator validator;

    public List<AnalyticsFieldMetadata> fields(SecurityUser user, Long templateVersionId) {
        TaskTemplateVersionVO template = templateService.getVersion(user.getTenantId(), templateVersionId);
        Map<String, Set<String>> typeAggregations = fieldTypeRegistry.metadata().stream()
            .collect(Collectors.toMap(value -> value.type(), value -> value.aggregations()));
        return template.getFields().stream()
            .filter(field -> !Boolean.TRUE.equals(field.getSensitive()))
            .filter(field -> field.getAnalytics() != null && Boolean.TRUE.equals(field.getAnalytics().get("enabled")))
            .map(field -> new AnalyticsFieldMetadata(field.getKey(), field.getLabel(), field.getType(),
                stringList(field.getAnalytics().get("role")),
                new ArrayList<>(typeAggregations.getOrDefault(field.getType(), Set.of())),
                text(field.getAnalytics().get("unit")), text(field.getAnalytics().get("aggregation")),
                field.getValidation() == null ? Map.of() : field.getValidation()))
            .toList();
    }

    public List<Map<String, Object>> dimensions() {
        return List.of(
            dimension("business_date", "业务日期", "time"),
            dimension("submitted_at", "提交时间", "time"),
            dimension("assignee", "执行人", "organization"),
            dimension("submitter", "提交人", "organization"),
            dimension("owner_group", "执行时所属组", "organization"),
            dimension("template", "任务模板", "task"),
            dimension("ci_model_group", "CI 模型组", "ci"),
            dimension("ci_model", "CI 模型", "ci"),
            dimension("ci_instance", "CI 实例", "ci")
        );
    }

    public AnalyticsQueryResponse query(SecurityUser user, AnalyticsQueryRequest request) {
        QueryData data = load(user, request);
        List<Map<String, Object>> rows = switch (data.validated().output()) {
            case "detail", "text_list" -> details(data, request, Map.of(), 1, data.validated().limit()).records();
            case "attachment_list", "image_gallery" -> attachments(data, request);
            default -> aggregate(data, request);
        };
        List<String> columns = rows.stream().flatMap(row -> row.keySet().stream()).distinct()
            .filter(column -> !INTERNAL_TRACE_COLUMNS.contains(column)).toList();
        return new AnalyticsQueryResponse(columns, columnLabels(columns, request, data.template()), rows,
            data.scannedFacts(), LocalDateTime.now(),
            data.validated().effectivePolicy(), definition(request, data.template()));
    }

    public AnalyticsDrilldownResponse drilldown(SecurityUser user, AnalyticsDrilldownRequest request) {
        QueryData data = load(user, request.query());
        return details(data, request.query(), request.dimensions() == null ? Map.of() : request.dimensions(),
            request.page() == null ? 1 : Math.max(1, request.page()),
            request.size() == null ? 50 : Math.min(200, Math.max(1, request.size())));
    }

    private QueryData load(SecurityUser user, AnalyticsQueryRequest request) {
        Long templateVersionId = request.source().templateVersionIds().getFirst();
        TaskTemplateVersionVO template = templateService.getVersion(user.getTenantId(), templateVersionId);
        AnalyticsQueryValidator.ValidatedQuery validated = validator.validate(request, template.getFields());
        List<TaskFieldFact> facts = factMapper.selectList(new LambdaQueryWrapper<TaskFieldFact>()
            .eq(TaskFieldFact::getTenantId, user.getTenantId())
            .eq(TaskFieldFact::getTemplateVersionId, templateVersionId)
            .eq(TaskFieldFact::getIsActive, true)
            .ge("business_date".equals(validated.timeField()), TaskFieldFact::getBusinessDate, request.time().from())
            .le("business_date".equals(validated.timeField()), TaskFieldFact::getBusinessDate, request.time().to())
            .orderByAsc(TaskFieldFact::getSubmissionId).orderByAsc(TaskFieldFact::getId));
        if (facts.size() > AnalyticsQueryValidator.MAX_FACTS) {
            throw AnalyticsQueryValidator.unprocessable("ANALYTICS_QUERY_BUDGET_EXCEEDED",
                "查询命中超过 " + AnalyticsQueryValidator.MAX_FACTS + " 条字段事实，请缩小时间范围或增加筛选条件");
        }
        Set<Long> taskIds = facts.stream().map(TaskFieldFact::getTaskId).collect(Collectors.toSet());
        Set<Long> submissionIds = facts.stream().map(TaskFieldFact::getSubmissionId).collect(Collectors.toSet());
        Map<Long, TaskInstance> tasks = taskIds.isEmpty() ? Map.of() : taskMapper.selectList(
            new LambdaQueryWrapper<TaskInstance>().eq(TaskInstance::getTenantId, user.getTenantId())
                .in(TaskInstance::getId, taskIds).eq(TaskInstance::getIsDeleted, false)).stream()
            .collect(Collectors.toMap(TaskInstance::getId, Function.identity()));
        Map<Long, TaskSubmission> submissions = submissionIds.isEmpty() ? Map.of() : submissionMapper.selectList(
            new LambdaQueryWrapper<TaskSubmission>().eq(TaskSubmission::getTenantId, user.getTenantId())
                .in(TaskSubmission::getId, submissionIds).eq(TaskSubmission::getEffective, true)).stream()
            .collect(Collectors.toMap(TaskSubmission::getId, Function.identity()));
        Set<Long> visibleTaskIds = visibleTaskIds(user, tasks.values());
        Map<Long, LocalDateTime> approvedAt = approvalTimes(user.getTenantId(), submissionIds);
        Map<Long, List<TaskSubmissionReference>> references = references(user.getTenantId(), submissionIds);

        Map<Long, RecordContextBuilder> builders = new LinkedHashMap<>();
        for (TaskFieldFact fact : facts) {
            TaskInstance task = tasks.get(fact.getTaskId());
            TaskSubmission submission = submissions.get(fact.getSubmissionId());
            if (task == null || submission == null || !visibleTaskIds.contains(task.getId())) continue;
            if (!matchesEffectivePolicy(task, validated.effectivePolicy())) continue;
            if (!matchesTime(request, validated, task, submission, approvedAt.get(submission.getId()))) continue;
            builders.computeIfAbsent(submission.getId(), ignored -> new RecordContextBuilder(task, submission,
                approvedAt.get(submission.getId()), references.getOrDefault(submission.getId(), List.of())))
                .facts.computeIfAbsent(fact.getFieldKey(), ignored -> new ArrayList<>()).add(fact);
        }
        List<RecordContext> records = builders.values().stream().map(RecordContextBuilder::build)
            .filter(record -> matchesFilters(record, request.filters(), validated))
            .filter(record -> matchesTextSearch(record, request.textSearch()))
            .toList();
        return new QueryData(template, validated, records, facts.size());
    }

    private Set<Long> visibleTaskIds(SecurityUser user, Collection<TaskInstance> tasks) {
        if (visibilityService.isTenantScope(user)) return tasks.stream().map(TaskInstance::getId).collect(Collectors.toSet());
        Set<Long> groups = visibilityService.groupIds(user);
        Set<Long> participantTasks = participantMapper.selectList(new LambdaQueryWrapper<TaskParticipant>()
            .eq(TaskParticipant::getTenantId, user.getTenantId()).eq(TaskParticipant::getUserId, user.getUserId()))
            .stream().map(TaskParticipant::getTaskId).collect(Collectors.toSet());
        return tasks.stream().filter(task -> user.getUserId().equals(task.getCreatedBy())
                || user.getUserId().equals(task.getAssigneeId())
                || task.getGroupId() != null && groups.contains(task.getGroupId())
                || participantTasks.contains(task.getId()))
            .map(TaskInstance::getId).collect(Collectors.toSet());
    }

    private Map<Long, LocalDateTime> approvalTimes(String tenantId, Set<Long> submissionIds) {
        if (submissionIds.isEmpty()) return Map.of();
        return approvalRoundMapper.selectList(new LambdaQueryWrapper<ApprovalRound>()
            .eq(ApprovalRound::getTenantId, tenantId).in(ApprovalRound::getSubmissionId, submissionIds)
            .eq(ApprovalRound::getStatus, "approved")).stream()
            .filter(value -> value.getEndedAt() != null)
            .collect(Collectors.toMap(ApprovalRound::getSubmissionId, ApprovalRound::getEndedAt,
                (left, right) -> left.isAfter(right) ? left : right));
    }

    private Map<Long, List<TaskSubmissionReference>> references(String tenantId, Set<Long> submissionIds) {
        if (submissionIds.isEmpty()) return Map.of();
        return referenceMapper.selectList(new LambdaQueryWrapper<TaskSubmissionReference>()
            .eq(TaskSubmissionReference::getTenantId, tenantId).in(TaskSubmissionReference::getSubmissionId, submissionIds))
            .stream().collect(Collectors.groupingBy(TaskSubmissionReference::getSubmissionId));
    }

    private boolean matchesTime(AnalyticsQueryRequest request, AnalyticsQueryValidator.ValidatedQuery validated,
                                TaskInstance task, TaskSubmission submission, LocalDateTime approvedAt) {
        LocalDate value = switch (validated.timeField()) {
            case "submitted_at" -> submission.getSubmittedAt().toLocalDate();
            case "approved_at" -> approvedAt == null ? null : approvedAt.toLocalDate();
            default -> task.getBusinessDate();
        };
        return value != null && !value.isBefore(request.time().from()) && !value.isAfter(request.time().to());
    }

    private boolean matchesEffectivePolicy(TaskInstance task, String policy) {
        return switch (policy) {
            case "approved_only" -> "approved".equals(task.getApprovalStatus());
            case "approved_or_no_approval" -> Set.of("approved", "not_required").contains(task.getApprovalStatus());
            default -> true;
        };
    }

    private boolean matchesTextSearch(RecordContext record, String search) {
        if (!StringUtils.hasText(search)) return true;
        String expected = search.trim().toLowerCase(Locale.ROOT);
        return record.facts().values().stream().flatMap(Collection::stream)
            .map(this::factValue).filter(Objects::nonNull)
            .anyMatch(value -> String.valueOf(value).toLowerCase(Locale.ROOT).contains(expected));
    }

    private List<Map<String, Object>> aggregate(QueryData data, AnalyticsQueryRequest request) {
        List<String> dimensions = request.dimensions() == null ? List.of() : request.dimensions();
        Map<GroupKey, Map<String, MetricAccumulator>> grouped = new LinkedHashMap<>();
        for (RecordContext record : data.records()) {
            List<Map<String, Object>> groups = dimensionCombinations(record, dimensions, data.validated().grain());
            if (groups.isEmpty()) groups = List.of(Map.of());
            for (Map<String, Object> values : groups) {
                GroupKey key = new GroupKey(values);
                Map<String, MetricAccumulator> accumulators = grouped.computeIfAbsent(key, ignored -> new LinkedHashMap<>());
                for (AnalyticsQueryRequest.Metric metric : request.metrics()) {
                    String alias = alias(metric);
                    accumulators.computeIfAbsent(alias, ignored -> new MetricAccumulator(metric.aggregation()))
                        .add(metricValues(record, metric, values), denominatorValues(record, metric), weightValues(record, metric));
                }
            }
        }
        if (grouped.size() > AnalyticsQueryValidator.MAX_GROUPS) {
            throw AnalyticsQueryValidator.unprocessable("ANALYTICS_DIMENSION_CARDINALITY_EXCEEDED",
                "维度组合超过 " + AnalyticsQueryValidator.MAX_GROUPS + " 组，请增加筛选或减少维度");
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        grouped.forEach((key, values) -> {
            Map<String, Object> row = new LinkedHashMap<>(key.values());
            values.forEach((alias, accumulator) -> row.put(alias, accumulator.result()));
            rows.add(row);
        });
        sort(rows, request.orderBy());
        return rows.stream().limit(data.validated().limit()).toList();
    }

    private AnalyticsDrilldownResponse details(QueryData data, AnalyticsQueryRequest request,
                                                Map<String, Object> dimensions, int page, int size) {
        List<Map<String, Object>> records = new ArrayList<>();
        for (RecordContext record : data.records()) {
            if (!matchesDimensions(record, dimensions, data.validated().grain())) continue;
            Map<String, Object> row = trace(record, data.template(), data.validated().fields());
            List<String> fields = request.detailFields() == null || request.detailFields().isEmpty()
                ? data.validated().fields().keySet().stream().toList() : request.detailFields();
            for (String field : fields) row.put(field, displayValue(record, field));
            records.add(row);
        }
        records.sort(Comparator.comparing(row -> String.valueOf(row.get("submittedAt")), Comparator.reverseOrder()));
        int from = Math.min(records.size(), (page - 1) * size);
        int to = Math.min(records.size(), from + size);
        LinkedHashSet<String> columns = records.stream().flatMap(row -> row.keySet().stream())
            .collect(Collectors.toCollection(LinkedHashSet::new));
        if (request.dimensions() != null) columns.addAll(request.dimensions());
        return new AnalyticsDrilldownResponse(List.copyOf(records.subList(from, to)),
            columnLabels(columns, request, data.template()), records.size(), page, size);
    }

    private List<Map<String, Object>> attachments(QueryData data, AnalyticsQueryRequest request) {
        Set<Long> submissionIds = data.records().stream().map(value -> value.submission().getId()).collect(Collectors.toSet());
        if (submissionIds.isEmpty()) return List.of();
        Map<Long, RecordContext> records = data.records().stream()
            .collect(Collectors.toMap(value -> value.submission().getId(), Function.identity()));
        Set<String> fieldKeys = request.detailFields() == null ? Set.of() : new LinkedHashSet<>(request.detailFields());
        return attachmentMapper.selectList(new LambdaQueryWrapper<TaskSubmissionAttachment>()
                .eq(TaskSubmissionAttachment::getTenantId, data.records().getFirst().task().getTenantId())
                .in(TaskSubmissionAttachment::getSubmissionId, submissionIds)
                .in(!fieldKeys.isEmpty(), TaskSubmissionAttachment::getFieldKey, fieldKeys)
                .orderByDesc(TaskSubmissionAttachment::getUploadedAt)).stream()
            .filter(value -> !Boolean.TRUE.equals(value.getSensitive()))
            .filter(value -> !"image_gallery".equals(data.validated().output()) || isImage(value.getFileType(), value.getFileName()))
            .limit(data.validated().limit())
            .map(value -> {
                RecordContext record = records.get(value.getSubmissionId());
                Map<String, Object> row = trace(record, data.template(), data.validated().fields());
                row.put("attachmentId", value.getId());
                row.put("fieldKey", value.getFieldKey());
                row.put("fileName", value.getFileName());
                row.put("contentType", value.getFileType());
                row.put("sizeBytes", value.getSizeBytes());
                row.put("uploadedAt", value.getUploadedAt());
                row.put("downloadPath", "/api/tasks/" + record.task().getId() + "/submissions/"
                    + record.submission().getId() + "/attachments/" + value.getId() + "/download");
                return row;
            }).toList();
    }

    private boolean matchesFilters(RecordContext record, List<AnalyticsQueryRequest.Filter> filters,
                                   AnalyticsQueryValidator.ValidatedQuery validated) {
        if (filters == null) return true;
        return filters.stream().allMatch(filter -> {
            List<Object> values = dimensionValues(record, filter.field(), validated.grain());
            return compare(values, filter.operator(), filter.value());
        });
    }

    private boolean compare(List<Object> values, String operator, Object expected) {
        if ("is_empty".equals(operator)) return values.isEmpty() || values.stream().allMatch(this::empty);
        if ("not_empty".equals(operator)) return values.stream().anyMatch(value -> !empty(value));
        Collection<?> expectedValues = expected instanceof Collection<?> collection ? collection : List.of(expected);
        return switch (operator) {
            case "eq" -> values.stream().anyMatch(value -> Objects.equals(normalize(value), normalize(expected)));
            case "ne" -> values.stream().noneMatch(value -> Objects.equals(normalize(value), normalize(expected)));
            case "in" -> values.stream().anyMatch(value -> expectedValues.stream().anyMatch(item -> Objects.equals(normalize(value), normalize(item))));
            case "not_in" -> values.stream().noneMatch(value -> expectedValues.stream().anyMatch(item -> Objects.equals(normalize(value), normalize(item))));
            case "contains" -> values.stream().anyMatch(value -> String.valueOf(value).toLowerCase(Locale.ROOT)
                .contains(String.valueOf(expected).toLowerCase(Locale.ROOT)));
            case "gt", "gte", "lt", "lte" -> values.stream().anyMatch(value -> compareNumbers(value, expected, operator));
            default -> false;
        };
    }

    private boolean compareNumbers(Object value, Object expected, String operator) {
        BigDecimal left = decimal(value);
        BigDecimal right = decimal(expected);
        if (left == null || right == null) return false;
        int comparison = left.compareTo(right);
        return switch (operator) {
            case "gt" -> comparison > 0;
            case "gte" -> comparison >= 0;
            case "lt" -> comparison < 0;
            case "lte" -> comparison <= 0;
            default -> false;
        };
    }

    private List<Map<String, Object>> dimensionCombinations(RecordContext record, List<String> dimensions, String grain) {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(new LinkedHashMap<>());
        for (String dimension : dimensions) {
            List<Object> values = dimensionValues(record, dimension, grain);
            if (values.isEmpty()) values = List.of("无该维度数据");
            List<Map<String, Object>> expanded = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                for (Object value : values) {
                    Map<String, Object> next = new LinkedHashMap<>(row);
                    next.put(dimension, value);
                    expanded.add(next);
                }
            }
            rows = expanded;
        }
        return rows;
    }

    private List<Object> dimensionValues(RecordContext record, String dimension, String grain) {
        return switch (dimension) {
            case "business_date" -> List.of(timeBucket(record.task().getBusinessDate(), grain));
            case "submitted_at" -> List.of(timeBucket(record.submission().getSubmittedAt().toLocalDate(), grain));
            case "assignee" -> snapshotValue(record.task().getOrganizationSnapshot(), "userId", record.task().getAssigneeId());
            case "submitter" -> List.of(record.submission().getSubmittedBy());
            case "owner_group" -> snapshotValue(record.task().getOrganizationSnapshot(), "groupId", record.task().getGroupId());
            case "template" -> List.of(record.task().getTemplateVersionId());
            case "ci_model_group" -> ciValues(record, "modelGroupCode", "model_group");
            case "ci_model" -> ciValues(record, "modelCode", "model");
            case "ci_instance" -> ciValues(record, "id", "instance");
            default -> fieldValues(record, dimension);
        };
    }

    private List<Object> ciValues(RecordContext record, String snapshotKey, String level) {
        List<Object> values = new ArrayList<>();
        Object raw = record.task().getCiScopeSnapshot() == null ? null : record.task().getCiScopeSnapshot().get("instances");
        if (raw instanceof Collection<?> instances) {
            for (Object item : instances) if (item instanceof Map<?, ?> map && map.get(snapshotKey) != null) values.add(map.get(snapshotKey));
        }
        for (TaskSubmissionReference reference : record.references()) {
            if (level.equals(reference.getSourceLevel())) values.add(reference.getRefKey());
            if (reference.getRefSnapshot() != null && reference.getRefSnapshot().get(snapshotKey) != null) {
                values.add(reference.getRefSnapshot().get(snapshotKey));
            }
        }
        return values.stream().filter(Objects::nonNull).distinct().toList();
    }

    private List<Object> fieldValues(RecordContext record, String fieldPath) {
        List<TaskFieldFact> facts = record.facts().getOrDefault(AnalyticsQueryValidator.rootField(fieldPath), List.of());
        if (facts.isEmpty()) return List.of();
        String nested = AnalyticsQueryValidator.nestedField(fieldPath);
        List<Object> values = new ArrayList<>();
        for (TaskFieldFact fact : facts) {
            if (StringUtils.hasText(nested) && StringUtils.hasText(fact.getSubFieldKey())) {
                if (!nested.equals(fact.getSubFieldKey())) continue;
                addFlattened(values, factValue(fact));
                continue;
            }
            Object value = factValue(fact);
            if (StringUtils.hasText(nested) && value instanceof Collection<?> rows) {
                rows.stream().filter(Map.class::isInstance).map(Map.class::cast).map(row -> row.get(nested))
                    .filter(Objects::nonNull).forEach(item -> addFlattened(values, item));
            } else if (!StringUtils.hasText(nested)) {
                addFlattened(values, value);
            }
        }
        return List.copyOf(values);
    }

    private void addFlattened(List<Object> values, Object value) {
        if (value instanceof Collection<?> collection) collection.stream().filter(Objects::nonNull).forEach(values::add);
        else if (value != null) values.add(value);
    }

    private List<Object> metricValues(RecordContext record, AnalyticsQueryRequest.Metric metric,
                                      Map<String, Object> groupValues) {
        String root = "ratio".equals(metric.aggregation()) ? metric.numeratorFieldKey() : metric.fieldKey();
        String fieldPath = StringUtils.hasText(metric.tableColumn()) ? root + "." + metric.tableColumn() : root;
        List<Object> values = fieldValues(record, fieldPath);
        Object groupValue = groupValues.get(fieldPath);
        if (groupValue == null && !StringUtils.hasText(metric.tableColumn())) groupValue = groupValues.get(root);
        if (groupValue == null) return values;
        Object expected = normalize(groupValue);
        return values.stream().filter(value -> Objects.equals(normalize(value), expected)).toList();
    }

    private List<Object> denominatorValues(RecordContext record, AnalyticsQueryRequest.Metric metric) {
        return StringUtils.hasText(metric.denominatorFieldKey())
            ? fieldValues(record, metric.denominatorFieldKey())
            : List.of();
    }

    private List<Object> weightValues(RecordContext record, AnalyticsQueryRequest.Metric metric) {
        return StringUtils.hasText(metric.weightFieldKey())
            ? fieldValues(record, metric.weightFieldKey())
            : List.of();
    }

    private Object displayValue(RecordContext record, String field) {
        List<Object> values = fieldValues(record, field);
        return values.size() == 1 ? values.getFirst() : values;
    }

    private Object factValue(TaskFieldFact fact) {
        if (fact.getValueNumber() != null) return fact.getValueNumber();
        if (fact.getValueBoolean() != null) return fact.getValueBoolean();
        if (fact.getValueDate() != null) return fact.getValueDate();
        if (fact.getValueDatetime() != null) return fact.getValueDatetime();
        if (fact.getReferenceKey() != null) return fact.getReferenceKey();
        if (fact.getValueJson() != null) return fact.getValueJson();
        return fact.getValueText();
    }

    private boolean matchesDimensions(RecordContext record, Map<String, Object> dimensions, String grain) {
        return dimensions.entrySet().stream().allMatch(entry -> dimensionValues(record, entry.getKey(), grain).stream()
            .anyMatch(value -> Objects.equals(normalize(value), normalize(entry.getValue()))));
    }

    private Map<String, Object> trace(RecordContext record, TaskTemplateVersionVO template,
                                      Map<String, TaskFieldDefinition> visibleFields) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("taskId", record.task().getId());
        row.put("taskTitle", record.task().getTitle());
        row.put("submissionId", record.submission().getId());
        row.put("submissionVersion", record.submission().getVersion());
        row.put("templateVersionId", record.submission().getTemplateVersionId());
        row.put("businessDate", record.task().getBusinessDate());
        row.put("submittedAt", record.submission().getSubmittedAt());
        row.put("assigneeId", record.task().getAssigneeId());
        row.put("groupId", record.task().getGroupId());
        row.put("fieldFactIds", record.facts().values().stream().flatMap(Collection::stream)
            .map(TaskFieldFact::getId).toList());
        Map<String, Object> snapshot = record.task().getOrganizationSnapshot();
        row.put("assignee", snapshotDisplay(snapshot, "realName", "username",
            record.task().getAssigneeId(), "未指定"));
        row.put("ownerGroup", snapshotDisplay(snapshot, "groupName", null,
            record.task().getGroupId(), "未分组"));
        row.put("fields", fieldLabels(record, template, visibleFields));
        return row;
    }

    private Object snapshotDisplay(Map<String, Object> snapshot, String primaryKey, String secondaryKey,
                                   Object fallback, String emptyLabel) {
        Object primary = snapshot == null ? null : snapshot.get(primaryKey);
        if (primary != null && StringUtils.hasText(String.valueOf(primary))) return primary;
        Object secondary = snapshot == null || secondaryKey == null ? null : snapshot.get(secondaryKey);
        if (secondary != null && StringUtils.hasText(String.valueOf(secondary))) return secondary;
        return fallback == null ? emptyLabel : fallback;
    }

    private List<String> fieldLabels(RecordContext record, TaskTemplateVersionVO template,
                                     Map<String, TaskFieldDefinition> visibleFields) {
        Set<String> factKeys = record.facts().keySet();
        List<String> labels = new ArrayList<>();
        for (TaskFieldDefinition field : template.getFields()) {
            if (!factKeys.contains(field.getKey()) || !visibleFields.containsKey(field.getKey())) continue;
            labels.add(StringUtils.hasText(field.getLabel()) ? field.getLabel() : field.getKey());
        }
        return labels;
    }

    private Map<String, Object> definition(AnalyticsQueryRequest request, TaskTemplateVersionVO template) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("templateVersionId", template.getId());
        result.put("templateName", template.getName());
        result.put("timeField", request.time().field() == null ? "business_date" : request.time().field());
        result.put("from", request.time().from());
        result.put("to", request.time().to());
        result.put("grain", request.time().grain() == null ? "day" : request.time().grain());
        result.put("metrics", request.metrics() == null ? List.of() : request.metrics());
        result.put("dimensions", request.dimensions() == null ? List.of() : request.dimensions());
        return result;
    }

    private String alias(AnalyticsQueryRequest.Metric metric) {
        if (StringUtils.hasText(metric.alias())) return metric.alias();
        if ("ratio".equals(metric.aggregation())) return metric.numeratorFieldKey() + "_ratio";
        return metric.fieldKey() + "_" + metric.aggregation();
    }

    private Map<String, String> columnLabels(Collection<String> columns, AnalyticsQueryRequest request,
                                             TaskTemplateVersionVO template) {
        Map<String, TaskFieldDefinition> fields = template.getFields().stream()
            .collect(Collectors.toMap(TaskFieldDefinition::getKey, Function.identity(),
                (left, right) -> left, LinkedHashMap::new));
        Map<String, String> metricLabels = new HashMap<>();
        if (request.metrics() != null) {
            request.metrics().forEach(metric -> metricLabels.put(alias(metric), metricLabel(metric, fields)));
        }
        LinkedHashSet<String> requestedColumns = new LinkedHashSet<>(columns);
        if (request.dimensions() != null) requestedColumns.addAll(request.dimensions());
        if (request.detailFields() != null) requestedColumns.addAll(request.detailFields());
        Map<String, String> labels = new LinkedHashMap<>();
        requestedColumns.forEach(column -> labels.put(column, columnLabel(column, fields, metricLabels)));
        return labels;
    }

    private String columnLabel(String column, Map<String, TaskFieldDefinition> fields,
                               Map<String, String> metricLabels) {
        if (SYSTEM_COLUMN_LABELS.containsKey(column)) return SYSTEM_COLUMN_LABELS.get(column);
        if (DIMENSION_LABELS.containsKey(column)) return DIMENSION_LABELS.get(column);
        if (metricLabels.containsKey(column)) return metricLabels.get(column);
        String fieldLabel = fieldLabel(column, fields);
        return fieldLabel == null ? column : fieldLabel;
    }

    private String metricLabel(AnalyticsQueryRequest.Metric metric, Map<String, TaskFieldDefinition> fields) {
        String sourceLabel;
        if ("ratio".equals(metric.aggregation())) {
            sourceLabel = displayFieldLabel(metric.numeratorFieldKey(), fields) + " / "
                + displayFieldLabel(metric.denominatorFieldKey(), fields);
        } else {
            String fieldPath = StringUtils.hasText(metric.tableColumn())
                ? metric.fieldKey() + "." + metric.tableColumn() : metric.fieldKey();
            sourceLabel = displayFieldLabel(fieldPath, fields);
        }
        return sourceLabel + "（" + AGGREGATION_LABELS.getOrDefault(metric.aggregation(), metric.aggregation()) + "）";
    }

    private String displayFieldLabel(String fieldPath, Map<String, TaskFieldDefinition> fields) {
        String label = fieldLabel(fieldPath, fields);
        return label == null ? fieldPath : label;
    }

    private String fieldLabel(String fieldPath, Map<String, TaskFieldDefinition> fields) {
        if (!StringUtils.hasText(fieldPath)) return null;
        TaskFieldDefinition field = fields.get(AnalyticsQueryValidator.rootField(fieldPath));
        if (field == null) return null;
        String label = StringUtils.hasText(field.getLabel()) ? field.getLabel() : field.getKey();
        String nested = AnalyticsQueryValidator.nestedField(fieldPath);
        if (!StringUtils.hasText(nested)) return label;
        String nestedLabel = nested;
        Object rawColumns = field.getValidation() == null ? null : field.getValidation().get("columns");
        if (rawColumns instanceof Iterable<?> columns) {
            for (Object raw : columns) {
                if (raw instanceof Map<?, ?> column && nested.equals(String.valueOf(column.get("key")))) {
                    Object configuredLabel = column.get("label");
                    if (configuredLabel != null && StringUtils.hasText(String.valueOf(configuredLabel))) {
                        nestedLabel = String.valueOf(configuredLabel);
                    }
                    break;
                }
            }
        }
        return label + " / " + nestedLabel;
    }

    private void sort(List<Map<String, Object>> rows, List<AnalyticsQueryRequest.Order> orderBy) {
        if (orderBy == null || orderBy.isEmpty()) return;
        Comparator<Map<String, Object>> comparator = null;
        for (AnalyticsQueryRequest.Order order : orderBy) {
            Comparator<Map<String, Object>> current = Comparator.comparing(
                row -> comparable(row.get(order.field())), Comparator.nullsLast(Comparator.naturalOrder()));
            if ("desc".equalsIgnoreCase(order.direction())) current = current.reversed();
            comparator = comparator == null ? current : comparator.thenComparing(current);
        }
        rows.sort(comparator);
    }

    private String comparable(Object value) {
        if (value instanceof BigDecimal number) return String.format(Locale.ROOT, "%040.10f", number);
        return value == null ? null : String.valueOf(value);
    }

    private Object normalize(Object value) {
        return value instanceof Number ? decimal(value) : value == null ? null : String.valueOf(value);
    }

    private BigDecimal decimal(Object value) {
        if (value == null) return null;
        try { return value instanceof BigDecimal decimal ? decimal : new BigDecimal(String.valueOf(value)); }
        catch (NumberFormatException exception) { return null; }
    }

    private boolean empty(Object value) {
        return value == null || value instanceof String text && text.isBlank()
            || value instanceof Collection<?> collection && collection.isEmpty();
    }

    private String timeBucket(LocalDate value, String grain) {
        if (value == null) return "无日期";
        return switch (grain) {
            case "week" -> value.get(IsoFields.WEEK_BASED_YEAR) + "-W"
                + String.format(Locale.ROOT, "%02d", value.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR));
            case "month" -> value.withDayOfMonth(1).toString().substring(0, 7);
            case "quarter" -> value.getYear() + "-Q" + value.get(IsoFields.QUARTER_OF_YEAR);
            case "year" -> String.valueOf(value.getYear());
            default -> value.toString();
        };
    }

    private List<Object> snapshotValue(Map<String, Object> snapshot, String key, Object fallback) {
        Object value = snapshot == null ? null : snapshot.get(key);
        return value == null && fallback == null ? List.of() : List.of(value == null ? fallback : value);
    }

    private Map<String, Object> dimension(String key, String label, String category) {
        return Map.of("key", key, "label", label, "category", category);
    }

    private String text(Object value) { return value == null ? null : String.valueOf(value); }

    private List<String> stringList(Object value) {
        if (!(value instanceof Collection<?> collection)) return List.of();
        return collection.stream().map(String::valueOf).toList();
    }

    private boolean isImage(String contentType, String fileName) {
        if (contentType != null && contentType.startsWith("image/")) return true;
        String name = fileName == null ? "" : fileName.toLowerCase(Locale.ROOT);
        return name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")
            || name.endsWith(".gif") || name.endsWith(".webp");
    }

    private record QueryData(TaskTemplateVersionVO template, AnalyticsQueryValidator.ValidatedQuery validated,
                             List<RecordContext> records, long scannedFacts) {}

    private record RecordContext(TaskInstance task, TaskSubmission submission, LocalDateTime approvedAt,
                                 Map<String, List<TaskFieldFact>> facts, List<TaskSubmissionReference> references) {}

    private static final class RecordContextBuilder {
        private final TaskInstance task;
        private final TaskSubmission submission;
        private final LocalDateTime approvedAt;
        private final List<TaskSubmissionReference> references;
        private final Map<String, List<TaskFieldFact>> facts = new LinkedHashMap<>();

        private RecordContextBuilder(TaskInstance task, TaskSubmission submission, LocalDateTime approvedAt,
                                     List<TaskSubmissionReference> references) {
            this.task = task;
            this.submission = submission;
            this.approvedAt = approvedAt;
            this.references = references;
        }

        private RecordContext build() {
            Map<String, List<TaskFieldFact>> immutable = new LinkedHashMap<>();
            facts.forEach((key, value) -> immutable.put(key, List.copyOf(value)));
            return new RecordContext(task, submission, approvedAt, Map.copyOf(immutable), references);
        }
    }

    private record GroupKey(Map<String, Object> values) {
        private GroupKey { values = Map.copyOf(values); }
    }

    private static final class MetricAccumulator {
        private final String aggregation;
        private BigDecimal sum = BigDecimal.ZERO;
        private BigDecimal denominator = BigDecimal.ZERO;
        private BigDecimal weightedSum = BigDecimal.ZERO;
        private BigDecimal weightSum = BigDecimal.ZERO;
        private BigDecimal min;
        private BigDecimal max;
        private long count;
        private final Set<String> distinct = new LinkedHashSet<>();

        private MetricAccumulator(String aggregation) { this.aggregation = aggregation; }

        private void add(List<Object> values, List<Object> denominators, List<Object> weights) {
            if ("ratio".equals(aggregation)) {
                values.stream().map(MetricAccumulator::decimalValue).filter(Objects::nonNull)
                    .forEach(value -> sum = sum.add(value));
                denominators.stream().map(MetricAccumulator::decimalValue).filter(Objects::nonNull)
                    .forEach(value -> denominator = denominator.add(value));
                return;
            }
            for (int index = 0; index < values.size(); index++) {
                Object raw = values.get(index);
                if (raw == null) continue;
                count++;
                distinct.add(String.valueOf(raw));
                BigDecimal value = decimalValue(raw);
                if (value == null) continue;
                sum = sum.add(value);
                min = min == null || value.compareTo(min) < 0 ? value : min;
                max = max == null || value.compareTo(max) > 0 ? value : max;
                if ("weighted_avg".equals(aggregation)) {
                    BigDecimal weight = weights.isEmpty() ? BigDecimal.ONE
                        : decimalValue(weights.get(Math.min(index, weights.size() - 1)));
                    if (weight == null) continue;
                    weightedSum = weightedSum.add(value.multiply(weight));
                    weightSum = weightSum.add(weight);
                }
            }
        }

        private static BigDecimal decimalValue(Object value) {
            if (value == null) return null;
            try { return value instanceof BigDecimal decimal ? decimal : new BigDecimal(String.valueOf(value)); }
            catch (NumberFormatException exception) { return null; }
        }

        private Object result() {
            return switch (aggregation) {
                case "sum" -> sum;
                case "avg" -> count == 0 ? null : sum.divide(BigDecimal.valueOf(count), 4, RoundingMode.HALF_UP);
                case "min" -> min;
                case "max" -> max;
                case "count" -> count;
                case "distinct_count" -> distinct.size();
                case "weighted_avg" -> weightSum.signum() == 0 ? null : weightedSum.divide(weightSum, 4, RoundingMode.HALF_UP);
                case "ratio" -> denominator.signum() == 0 ? null : sum.divide(denominator, 4, RoundingMode.HALF_UP);
                default -> null;
            };
        }
    }
}
