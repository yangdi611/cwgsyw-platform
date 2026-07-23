package com.cwgsyw.platform.module.task.plan.dto;

import java.util.Map;

public record AssignmentTarget(
    String subjectType,
    Long subjectId,
    Long assigneeId,
    Long groupId,
    String displayName,
    Map<String, Object> organizationSnapshot
) {
}
