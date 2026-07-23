package com.cwgsyw.platform.module.approval.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ApprovalRoundVO(
    Long id,
    Long taskId,
    Long submissionId,
    Long schemeVersionId,
    Integer roundNumber,
    String processInstanceId,
    String processDefinitionId,
    String status,
    String result,
    Long startedBy,
    LocalDateTime startedAt,
    LocalDateTime endedAt,
    List<ApprovalActionVO> actions
) {
}
