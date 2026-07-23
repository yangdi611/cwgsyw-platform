package com.cwgsyw.platform.module.task.plan.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.Map;

public record CiScopeRequest(
    @NotEmpty List<@Valid CiScopeSelection> selections,
    Map<String, Object> filters,
    @Min(1) @Max(1000) Integer limit
) {
}
