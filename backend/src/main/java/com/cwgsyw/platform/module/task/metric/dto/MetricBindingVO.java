package com.cwgsyw.platform.module.task.metric.dto;

import java.util.Map;

public record MetricBindingVO(
    Long id, Long metricId, Long templateVersionId, Long fieldId, String fieldKey,
    String fieldLabel, String fieldType, String sourceRole, String ratioComponent, Map<String, Object> unitConversion,
    boolean enabled
) {}
