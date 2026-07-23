package com.cwgsyw.platform.module.task.metric.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record MetricPreviewRequest(@NotNull LocalDate from, @NotNull LocalDate to, Long groupId) {}
