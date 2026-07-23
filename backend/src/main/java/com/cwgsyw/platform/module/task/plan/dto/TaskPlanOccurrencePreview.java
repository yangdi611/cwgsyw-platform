package com.cwgsyw.platform.module.task.plan.dto;

import java.time.LocalDateTime;
import java.util.List;

public record TaskPlanOccurrencePreview(
    LocalDateTime occurrenceAt,
    LocalDateTime dueAt,
    int taskCount,
    List<AssignmentTarget> targets,
    long ciCount,
    List<String> warnings
) {
}
