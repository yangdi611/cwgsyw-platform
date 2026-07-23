package com.cwgsyw.platform.module.task.analytics.service;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsQueryRequest;
import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class AnalyticsQueryValidator {
    public static final int MAX_FACTS = 20_000;
    public static final int MAX_GROUPS = 1_000;
    public static final int MAX_RESULT_ROWS = 500;
    private static final long MAX_RANGE_DAYS = 730;
    private static final Set<String> TIME_FIELDS = Set.of("business_date", "submitted_at", "approved_at");
    private static final Set<String> GRAINS = Set.of("day", "week", "month", "quarter", "year");
    private static final Set<String> AGGREGATIONS = Set.of(
        "sum", "avg", "min", "max", "count", "distinct_count", "weighted_avg", "ratio");
    private static final Set<String> OPERATORS = Set.of(
        "eq", "ne", "in", "not_in", "contains", "gt", "gte", "lt", "lte", "is_empty", "not_empty");
    private static final Set<String> DIMENSIONS = Set.of(
        "business_date", "submitted_at", "assignee", "submitter", "owner_group",
        "template", "ci_model_group", "ci_model", "ci_instance");
    private static final Set<String> OUTPUTS = Set.of("aggregate", "detail", "text_list", "attachment_list", "image_gallery");

    public ValidatedQuery validate(AnalyticsQueryRequest request, List<TaskFieldDefinition> fields) {
        if (request.source().templateVersionIds().size() != 1) {
            throw unprocessable("ANALYTICS_SINGLE_TEMPLATE_REQUIRED", "当前统计阶段每个查询只能选择一个模板版本");
        }
        if (request.time().from().isAfter(request.time().to())) {
            throw unprocessable("ANALYTICS_TIME_RANGE_INVALID", "统计开始日期不能晚于结束日期");
        }
        if (ChronoUnit.DAYS.between(request.time().from(), request.time().to()) > MAX_RANGE_DAYS) {
            throw unprocessable("ANALYTICS_TIME_RANGE_EXCEEDED", "同步统计时间范围不能超过 730 天，请缩小范围");
        }
        String timeField = defaultText(request.time().field(), "business_date");
        String grain = defaultText(request.time().grain(), "day");
        if (!TIME_FIELDS.contains(timeField)) throw unprocessable("ANALYTICS_TIME_FIELD_INVALID", "不支持的时间口径: " + timeField);
        if (!GRAINS.contains(grain)) throw unprocessable("ANALYTICS_GRAIN_INVALID", "不支持的时间粒度: " + grain);

        Map<String, TaskFieldDefinition> allowedFields = new HashMap<>();
        for (TaskFieldDefinition field : fields) {
            if (!Boolean.TRUE.equals(field.getSensitive()) && field.getAnalytics() != null
                    && Boolean.TRUE.equals(field.getAnalytics().get("enabled"))) {
                allowedFields.put(field.getKey(), field);
            }
        }
        List<AnalyticsQueryRequest.Metric> metrics = request.metrics() == null ? List.of() : request.metrics();
        String output = defaultText(request.output(), "aggregate");
        if (!OUTPUTS.contains(output)) throw unprocessable("ANALYTICS_OUTPUT_INVALID", "不支持的统计输出类型: " + output);
        if ("aggregate".equals(output) && metrics.isEmpty()) {
            throw unprocessable("ANALYTICS_METRIC_REQUIRED", "聚合统计至少需要一个指标");
        }
        for (AnalyticsQueryRequest.Metric metric : metrics) validateMetric(metric, allowedFields);

        List<String> dimensions = request.dimensions() == null ? List.of() : request.dimensions();
        if (dimensions.size() > 4) throw unprocessable("ANALYTICS_DIMENSION_LIMIT", "单次查询最多选择 4 个维度");
        dimensions.forEach(dimension -> requireDimension(dimension, allowedFields));
        List<AnalyticsQueryRequest.Filter> filters = request.filters() == null ? List.of() : request.filters();
        if (filters.size() > 20) throw unprocessable("ANALYTICS_FILTER_LIMIT", "单次查询最多配置 20 个筛选条件");
        filters.forEach(filter -> {
            if (!OPERATORS.contains(filter.operator())) throw unprocessable("ANALYTICS_FILTER_OPERATOR_INVALID", "不支持的筛选操作: " + filter.operator());
            requireDimension(filter.field(), allowedFields);
        });
        List<String> details = request.detailFields() == null ? List.of() : request.detailFields();
        details.forEach(field -> requireField(field, allowedFields));
        int limit = request.limit() == null ? 100 : request.limit();
        if (limit < 1 || limit > MAX_RESULT_ROWS) {
            throw unprocessable("ANALYTICS_RESULT_LIMIT", "同步查询返回行数必须在 1 到 " + MAX_RESULT_ROWS + " 之间");
        }
        String effectivePolicy = defaultText(request.effectivePolicy(), "approved_or_no_approval");
        if (!Set.of("approved_or_no_approval", "approved_only", "current_effective").contains(effectivePolicy)) {
            throw unprocessable("ANALYTICS_EFFECTIVE_POLICY_INVALID", "不支持的有效数据口径: " + effectivePolicy);
        }
        return new ValidatedQuery(timeField, grain, output, effectivePolicy, limit, allowedFields);
    }

    private void validateMetric(AnalyticsQueryRequest.Metric metric, Map<String, TaskFieldDefinition> fields) {
        if (!AGGREGATIONS.contains(metric.aggregation())) {
            throw unprocessable("ANALYTICS_AGGREGATION_INVALID", "不支持的聚合方式: " + metric.aggregation());
        }
        if ("ratio".equals(metric.aggregation())) {
            requireNumeric(metric.numeratorFieldKey(), fields);
            requireNumeric(metric.denominatorFieldKey(), fields);
            return;
        }
        requireField(metric.fieldKey(), fields);
        TaskFieldDefinition field = fields.get(rootField(metric.fieldKey()));
        if ("weighted_avg".equals(metric.aggregation())) requireNumeric(metric.weightFieldKey(), fields);
        if (Set.of("sum", "avg", "min", "max", "weighted_avg").contains(metric.aggregation())
                && !isNumeric(field, metric.tableColumn())) {
            throw unprocessable("ANALYTICS_NUMERIC_FIELD_REQUIRED", "聚合 " + metric.aggregation() + " 只能用于数字字段");
        }
        if (StringUtils.hasText(metric.tableColumn()) && !Set.of("table", "repeater").contains(field.getType())) {
            throw unprocessable("ANALYTICS_TABLE_COLUMN_INVALID", "只有表格或重复区块字段可以指定列");
        }
    }

    private void requireDimension(String value, Map<String, TaskFieldDefinition> fields) {
        if (DIMENSIONS.contains(value)) return;
        requireField(value, fields);
    }

    private void requireNumeric(String value, Map<String, TaskFieldDefinition> fields) {
        requireField(value, fields);
        if (!isNumeric(fields.get(rootField(value)), nestedField(value))) {
            throw unprocessable("ANALYTICS_NUMERIC_FIELD_REQUIRED", "字段 " + value + " 不是可计算数字字段");
        }
    }

    private void requireField(String value, Map<String, TaskFieldDefinition> fields) {
        if (!StringUtils.hasText(value) || !fields.containsKey(rootField(value))) {
            throw unprocessable("ANALYTICS_FIELD_NOT_ALLOWED", "字段未启用统计或无权使用: " + value);
        }
    }

    private boolean isNumeric(TaskFieldDefinition field, String nested) {
        if (field == null) return false;
        if (Set.of("number", "money", "percentage", "rating", "duration", "formula", "aggregate_reference").contains(field.getType())) return true;
        if (!StringUtils.hasText(nested) || !Set.of("table", "repeater").contains(field.getType())) return false;
        Object rawColumns = field.getValidation() == null ? null : field.getValidation().get("columns");
        if (!(rawColumns instanceof Iterable<?> columns)) return false;
        for (Object raw : columns) {
            if (raw instanceof Map<?, ?> column && nested.equals(String.valueOf(column.get("key")))) {
                return Set.of("number", "money", "percentage", "rating", "duration").contains(String.valueOf(column.get("type")));
            }
        }
        return false;
    }

    public static String rootField(String value) {
        if (value == null) return null;
        int separator = value.indexOf('.');
        return separator < 0 ? value : value.substring(0, separator);
    }

    public static String nestedField(String value) {
        if (value == null) return null;
        int separator = value.indexOf('.');
        return separator < 0 ? null : value.substring(separator + 1);
    }

    private String defaultText(String value, String fallback) {
        return StringUtils.hasText(value) ? value : fallback;
    }

    public static BusinessException unprocessable(String code, String message) {
        return new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
    }

    public record ValidatedQuery(
        String timeField,
        String grain,
        String output,
        String effectivePolicy,
        int limit,
        Map<String, TaskFieldDefinition> fields
    ) {}
}
