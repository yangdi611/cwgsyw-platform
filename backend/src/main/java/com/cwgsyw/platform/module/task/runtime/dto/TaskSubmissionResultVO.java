package com.cwgsyw.platform.module.task.runtime.dto;

public record TaskSubmissionResultVO(
    Long taskId,
    Long submissionId,
    Integer version,
    String executionStatus,
    String approvalStatus,
    Long approvalRoundId
) {
}
