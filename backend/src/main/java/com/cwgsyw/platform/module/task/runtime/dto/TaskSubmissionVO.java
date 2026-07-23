package com.cwgsyw.platform.module.task.runtime.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record TaskSubmissionVO(
    Long id,
    Long taskId,
    Long templateVersionId,
    Integer version,
    Map<String, Object> formData,
    Map<String, Object> computedValues,
    Map<String, Object> organizationSnapshot,
    Map<String, Object> ciReferencesSnapshot,
    String status,
    Boolean effective,
    Long supersedesSubmissionId,
    Long submittedBy,
    LocalDateTime submittedAt,
    List<TaskSubmissionAttachmentVO> attachments
) {
}
