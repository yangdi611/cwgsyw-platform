package com.cwgsyw.platform.module.task.metric.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record MetricDefinitionVO(
    Long id, String code, String name, String description, String valueType, String unit,
    Integer scale, String aggregation, String additivity, Map<String, Object> formulaConfig,
    Map<String, Object> authorityPolicy, List<MetricBindingVO> bindings,
    LocalDateTime createdAt, LocalDateTime updatedAt
) {}
