package com.cwgsyw.platform.module.approval.dto;

import com.cwgsyw.platform.module.task.runtime.dto.TaskSubmissionAttachmentVO;
import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;

import java.util.List;
import java.util.Map;

public record ApprovalTaskDetailVO(
    ApprovalTaskSummaryVO task,
    ApprovalRoundVO round,
    Integer submissionVersion,
    Map<String, Object> formData,
    Map<String, Object> computedValues,
    List<TaskFieldDefinition> fields,
    List<TaskSubmissionAttachmentVO> attachments,
    List<String> allowedActions
) {
}
