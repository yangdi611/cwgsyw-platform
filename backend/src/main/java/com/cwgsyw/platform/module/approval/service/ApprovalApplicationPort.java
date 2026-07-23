package com.cwgsyw.platform.module.approval.service;

import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.entity.TaskSubmission;

public interface ApprovalApplicationPort {
    Long start(TaskInstance task, TaskSubmission submission, Long submittedBy);

    Long findRoundId(String tenantId, Long submissionId);

}
