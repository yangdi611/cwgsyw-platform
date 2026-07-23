package com.cwgsyw.platform.module.task.automation;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public record TaskLifecycleEvent(
    String tenantId,
    String eventType,
    Long taskId,
    Long submissionId,
    LocalDateTime occurredAt,
    Map<String, Object> attributes
) {
    public TaskLifecycleEvent(String tenantId, String eventType, Long taskId, Long submissionId,
                              LocalDateTime occurredAt) {
        this(tenantId, eventType, taskId, submissionId, occurredAt, Map.of());
    }

    public TaskLifecycleEvent {
        if (attributes == null || attributes.isEmpty()) {
            attributes = Map.of();
        } else {
            Map<String, Object> sanitized = new LinkedHashMap<>();
            attributes.forEach((key, value) -> {
                if (key != null && value != null) sanitized.put(key, value);
            });
            attributes = Collections.unmodifiableMap(sanitized);
        }
    }

    public String sourceType() {
        if ("metric_threshold".equals(eventType)) return "metric_fact";
        if ("submission_approved".equals(eventType)) return "submission";
        return "task";
    }

    public Long sourceId() {
        if ("metric_threshold".equals(eventType)) return numberAttribute("metricFactId");
        if ("submission_approved".equals(eventType)) return submissionId;
        return taskId;
    }

    private Long numberAttribute(String key) {
        Object value = attributes.get(key);
        if (value == null) return null;
        return value instanceof Number number ? number.longValue() : Long.valueOf(String.valueOf(value));
    }
}
