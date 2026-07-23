package com.cwgsyw.platform.module.task.runtime.service;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.task.metric.TaskMetricService;
import com.cwgsyw.platform.module.task.metric.dto.MetricPreviewRequest;
import com.cwgsyw.platform.module.task.metric.dto.MetricPreviewVO;
import com.cwgsyw.platform.module.task.runtime.dto.AggregateReferencePreviewVO;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Resolves server-authoritative aggregate-reference fields and their frozen lineage. */
@Service
@RequiredArgsConstructor
public class TaskAggregateReferenceService {
    private final TaskMetricService metricService;

    public List<AggregateReferencePreviewVO> preview(SecurityUser user, TaskInstance task,
                                                      List<TaskFieldDefinition> fields) {
        List<AggregateReferencePreviewVO> previews = new ArrayList<>();
        for (TaskFieldDefinition field : fields) {
            if (!"aggregate_reference".equals(field.getType())) continue;
            AggregateConfig config = configuration(field, task);
            MetricPreviewVO metric = metricService.preview(user, config.metricId(),
                new MetricPreviewRequest(config.from(), config.to(), config.groupId()));
            previews.add(toPreview(field.getKey(), config, metric));
        }
        return List.copyOf(previews);
    }

    public Resolution resolve(SecurityUser user, TaskInstance task, List<TaskFieldDefinition> fields,
                              Map<String, Object> submittedValues, boolean rejectMismatches) {
        Map<String, Object> resolvedValues = new LinkedHashMap<>(submittedValues);
        List<AggregateReferencePreviewVO> previews = preview(user, task, fields);
        for (AggregateReferencePreviewVO preview : previews) {
            Object supplied = submittedValues.get(preview.fieldKey());
            if (rejectMismatches && supplied != null && !sameNumber(supplied, preview.selectedValue())) {
                throw BusinessException.badRequest("TASK_AGGREGATE_REFERENCE_READ_ONLY",
                    "汇总引用字段由系统计算，请刷新后重新提交");
            }
            resolvedValues.put(preview.fieldKey(), preview.selectedValue());
        }
        return new Resolution(Map.copyOf(resolvedValues), previews);
    }

    public Map<String, Object> snapshot(AggregateReferencePreviewVO preview) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("metricId", preview.metricId());
        value.put("fieldKey", preview.fieldKey());
        value.put("from", preview.from().toString());
        value.put("to", preview.to().toString());
        value.put("groupId", preview.groupId());
        value.put("systemValue", preview.systemValue());
        value.put("manualValue", preview.manualValue());
        value.put("difference", preview.difference());
        value.put("selectedSourceRole", preview.selectedSourceRole());
        value.put("selectedValue", preview.selectedValue());
        value.put("sourceTaskCount", preview.sourceTaskCount());
        value.put("factIds", preview.factIds());
        value.put("taskIds", preview.taskIds());
        value.put("submissionIds", preview.submissionIds());
        return value;
    }

    private AggregateReferencePreviewVO toPreview(String fieldKey, AggregateConfig config, MetricPreviewVO metric) {
        BigDecimal selectedValue = "manual_report".equals(metric.selectedSourceRole())
            ? metric.manualValue() : metric.systemValue();
        return new AggregateReferencePreviewVO(fieldKey, metric.metricId(), metric.from(), metric.to(), config.groupId(),
            metric.systemValue(), metric.manualValue(), metric.difference(), metric.selectedSourceRole(), selectedValue,
            metric.sourceTaskCount(), metric.factIds(), metric.taskIds(), metric.submissionIds());
    }

    @SuppressWarnings("unchecked")
    private AggregateConfig configuration(TaskFieldDefinition field, TaskInstance task) {
        Map<String, Object> validation = field.getValidation() == null ? Map.of() : field.getValidation();
        Object raw = validation.get("aggregate");
        if (!(raw instanceof Map<?, ?> rawConfig)) {
            throw invalidConfig(field, "缺少 validation.aggregate 配置");
        }
        Map<String, Object> config = (Map<String, Object>) rawConfig;
        Long metricId = positiveLong(config.get("metricId"), field, "metricId");
        LocalDate from = date(config.get("from"), field, "from");
        LocalDate to = date(config.get("to"), field, "to");
        if (from.isAfter(to)) throw invalidConfig(field, "开始日期不能晚于结束日期");
        Long groupId = config.get("groupId") == null ? task.getGroupId() : positiveLong(config.get("groupId"), field, "groupId");
        return new AggregateConfig(metricId, from, to, groupId);
    }

    private Long positiveLong(Object value, TaskFieldDefinition field, String key) {
        try {
            long parsed = Long.parseLong(String.valueOf(value));
            if (parsed > 0) return parsed;
        } catch (NumberFormatException ignored) {
            // Converted to the field-level contract error below.
        }
        throw invalidConfig(field, key + " 必须是正整数");
    }

    private LocalDate date(Object value, TaskFieldDefinition field, String key) {
        try {
            return LocalDate.parse(String.valueOf(value));
        } catch (DateTimeParseException exception) {
            throw invalidConfig(field, key + " 必须是 ISO 日期");
        }
    }

    private boolean sameNumber(Object supplied, BigDecimal resolved) {
        if (resolved == null) return supplied == null || supplied instanceof String text && text.isBlank();
        try {
            return new BigDecimal(String.valueOf(supplied)).compareTo(resolved) == 0;
        } catch (NumberFormatException exception) {
            return false;
        }
    }

    private BusinessException invalidConfig(TaskFieldDefinition field, String message) {
        return BusinessException.badRequest("TASK_AGGREGATE_REFERENCE_CONFIG_INVALID",
            "字段 " + field.getKey() + " 的汇总引用配置无效：" + message);
    }

    public record Resolution(Map<String, Object> values, List<AggregateReferencePreviewVO> previews) {
    }

    private record AggregateConfig(Long metricId, LocalDate from, LocalDate to, Long groupId) {
    }
}
