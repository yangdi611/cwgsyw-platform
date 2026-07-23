package com.cwgsyw.platform.module.task.runtime.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record TaskDraftVO(
    Long id,
    Long taskId,
    Integer revision,
    Map<String, Object> formData,
    List<TaskDraftAttachmentVO> attachments,
    Long lastSavedBy,
    LocalDateTime lastSavedAt
) {
}
