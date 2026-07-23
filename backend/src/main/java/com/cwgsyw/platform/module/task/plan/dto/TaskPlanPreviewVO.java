package com.cwgsyw.platform.module.task.plan.dto;

import java.util.List;

public record TaskPlanPreviewVO(
    String templateName,
    List<TaskPlanOccurrencePreview> occurrences,
    int totalTaskCount,
    List<String> warnings
) {
}
