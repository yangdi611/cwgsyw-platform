package com.cwgsyw.platform.module.task.metric.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record MetricBindingRequest(
    @NotNull Long templateVersionId,
    @NotNull Long fieldId,
    @NotBlank String sourceRole,
    String ratioComponent,
    Map<String, Object> unitConversion,
    Boolean enabled
) {}
