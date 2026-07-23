package com.cwgsyw.platform.module.task.template.form;

import com.cwgsyw.platform.module.task.template.dto.FieldTypeMetadata;
import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.dto.TemplateValidationIssue;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class FieldTypeRegistry {
    private static final Set<String> NUMERIC_AGGREGATIONS = Set.of("sum", "avg", "min", "max", "count", "distinct_count");
    private static final Set<String> DIMENSION_AGGREGATIONS = Set.of("count", "distinct_count");
    private static final Set<String> COUNT_AGGREGATIONS = Set.of("count");

    private final Map<String, FieldTypeHandler> handlers = new LinkedHashMap<>();

    public FieldTypeRegistry() {
        register("text", "单行文本", "基础输入", true, true, DIMENSION_AGGREGATIONS);
        register("textarea", "多行文本", "基础输入", true, true, COUNT_AGGREGATIONS);
        register("rich_text", "富文本", "基础输入", false, false, Set.of());
        register("number", "数字", "基础输入", true, true, NUMERIC_AGGREGATIONS);
        register("money", "金额", "基础输入", true, true, NUMERIC_AGGREGATIONS);
        register("percentage", "百分比", "基础输入", true, true, NUMERIC_AGGREGATIONS);
        register("single_select", "单选", "选择", true, true, DIMENSION_AGGREGATIONS);
        register("multi_select", "多选", "选择", true, true, DIMENSION_AGGREGATIONS);
        register("boolean", "开关", "选择", true, true, DIMENSION_AGGREGATIONS);
        register("rating", "评分", "选择", true, true, NUMERIC_AGGREGATIONS);
        register("tags", "标签", "选择", true, true, DIMENSION_AGGREGATIONS);
        register("date", "日期", "时间", true, true, DIMENSION_AGGREGATIONS);
        register("datetime", "日期时间", "时间", true, true, DIMENSION_AGGREGATIONS);
        register("date_range", "时间段", "时间", false, false, Set.of());
        register("duration", "时长", "时间", true, true, NUMERIC_AGGREGATIONS);
        register("user", "人员", "组织", true, true, DIMENSION_AGGREGATIONS);
        register("group", "用户组", "组织", true, true, DIMENSION_AGGREGATIONS);
        register("role", "角色", "组织", true, true, DIMENSION_AGGREGATIONS);
        register("ci_scope", "CI 范围", "运维对象", true, true, DIMENSION_AGGREGATIONS);
        register("relation", "关联对象", "运维对象", true, true, DIMENSION_AGGREGATIONS);
        register("table", "表格", "结构化", true, false, NUMERIC_AGGREGATIONS);
        register("repeater", "重复区块", "结构化", true, false, COUNT_AGGREGATIONS);
        register("file", "文件", "文件", true, false, COUNT_AGGREGATIONS);
        register("image", "图片", "文件", true, false, COUNT_AGGREGATIONS);
        register("formula", "公式字段", "计算", true, true, NUMERIC_AGGREGATIONS);
        register("aggregate_reference", "引用汇总", "计算", true, true, NUMERIC_AGGREGATIONS);
        register("section", "分组标题", "布局", false, false, Set.of());
        register("help_text", "说明文本", "布局", false, false, Set.of());
    }

    public List<FieldTypeMetadata> metadata() {
        return handlers.values().stream().map(FieldTypeHandler::metadata).toList();
    }

    public List<TemplateValidationIssue> validateConfiguration(TaskFieldDefinition field) {
        FieldTypeHandler handler = handlers.get(field.getType());
        if (handler == null) {
            return List.of(new TemplateValidationIssue(
                "FIELD_TYPE_UNKNOWN", field.getKey(), "type", "不支持的字段类型: " + field.getType()));
        }
        return handler.validateConfiguration(field);
    }

    public FieldValueResult normalizeAndValidate(TaskFieldDefinition field, Object value, String path) {
        FieldTypeHandler handler = handlers.get(field.getType());
        if (handler == null) {
            return new FieldValueResult(value, List.of(new TemplateValidationIssue(
                "FIELD_TYPE_UNKNOWN", field.getKey(), path, "不支持的字段类型: " + field.getType())));
        }
        return handler.normalizeAndValidate(field, value, path);
    }

    public List<TemplateValidationIssue> validateAll(List<TaskFieldDefinition> fields) {
        List<TemplateValidationIssue> issues = new ArrayList<>();
        for (TaskFieldDefinition field : fields) issues.addAll(validateConfiguration(field));
        return issues;
    }

    private void register(String type, String label, String category, boolean supportsAnalytics,
                          boolean supportsDimension, Set<String> aggregations) {
        FieldTypeMetadata metadata = new FieldTypeMetadata(
            type, label, category, supportsAnalytics, supportsDimension, true, true, aggregations);
        handlers.put(type, new BuiltinFieldTypeHandler(metadata));
    }
}
