package com.cwgsyw.platform.module.approval.service;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.approval.dto.ApprovalTaskSummaryVO;
import com.cwgsyw.platform.security.SecurityUser;

import java.time.LocalDate;

public interface ApprovalTaskQueryPort {
    PageResult<ApprovalTaskSummaryVO> pending(SecurityUser user, String keyword, Long templateId,
                                              String status, String priority, Boolean overdue,
                                              Long groupId, LocalDate from, LocalDate to,
                                              int page, int size);

    PageResult<ApprovalTaskSummaryVO> pending(SecurityUser user, String keyword, int page, int size);
}
