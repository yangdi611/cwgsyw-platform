package com.cwgsyw.platform.module.task.analytics.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public record AnalyticsQueryRequest(
    @NotNull @Valid Source source,
    @NotNull @Valid TimeRange time,
    @Valid List<Metric> metrics,
    List<String> dimensions,
    @Valid List<Filter> filters,
    String effectivePolicy,
    @Valid List<Order> orderBy,
    Integer limit,
    String output,
    List<String> detailFields,
    String textSearch
) {
    public record Source(@NotEmpty List<Long> templateVersionIds) {}

    public record TimeRange(
        String field,
        @NotNull LocalDate from,
        @NotNull LocalDate to,
        String grain
    ) {}

    public record Metric(
        String fieldKey,
        String tableColumn,
        @NotNull String aggregation,
        String alias,
        String numeratorFieldKey,
        String denominatorFieldKey,
        String weightFieldKey
    ) {}

    public record Filter(String field, @NotNull String operator, Object value) {}

    public record Order(@NotNull String field, String direction) {}
}
