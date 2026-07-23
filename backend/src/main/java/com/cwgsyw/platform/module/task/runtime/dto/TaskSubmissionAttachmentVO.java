package com.cwgsyw.platform.module.task.runtime.dto;

import java.time.LocalDateTime;

public record TaskSubmissionAttachmentVO(
    Long id,
    String fieldKey,
    String fileName,
    String fileType,
    Long sizeBytes,
    String checksum,
    Boolean sensitive,
    LocalDateTime uploadedAt
) {
}
