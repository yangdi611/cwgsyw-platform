package com.cwgsyw.platform.module.task.metric.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Map;

public record MetricDefinitionRequest(
    @NotBlank @Size(max = 100) String code,
    @NotBlank @Size(max = 255) String name,
    String description,
    @NotBlank String valueType,
    @Size(max = 50) String unit,
    @Min(0) @Max(10) Integer scale,
    @NotBlank String aggregation,
    @NotBlank String additivity,
    Map<String, Object> formulaConfig,
    Map<String, Object> authorityPolicy
) {}
