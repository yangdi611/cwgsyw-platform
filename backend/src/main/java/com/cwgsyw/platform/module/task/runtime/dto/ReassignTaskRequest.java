package com.cwgsyw.platform.module.task.runtime.dto;

import jakarta.validation.constraints.NotNull;

public record ReassignTaskRequest(@NotNull Long assigneeId, Long groupId, String reason) {
}
