package com.cwgsyw.platform.module.task.runtime.dto;

import com.cwgsyw.platform.module.task.template.dto.TaskTemplateVersionVO;

import java.util.List;

public record TaskDetailVO(
    TaskSummaryVO task,
    TaskTemplateVersionVO template,
    TaskDraftVO draft,
    TaskSubmissionVO currentSubmission,
    List<TaskEventVO> timeline,
    TaskActionsVO actions
) {
}
