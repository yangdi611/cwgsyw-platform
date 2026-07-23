package com.cwgsyw.platform.module.task.plan.service;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.task.plan.dto.TaskPlanDetailVO;
import com.cwgsyw.platform.module.task.plan.dto.TaskPlanGenerationVO;
import com.cwgsyw.platform.module.task.plan.dto.TaskPlanPreviewRequest;
import com.cwgsyw.platform.module.task.plan.dto.TaskPlanPreviewVO;
import com.cwgsyw.platform.module.task.plan.dto.TaskPlanSummaryVO;
import com.cwgsyw.platform.module.task.plan.dto.UpsertTaskPlanRequest;

import java.util.List;

public interface TaskPlanService {
    PageResult<TaskPlanSummaryVO> list(String tenantId, String keyword, String status, int page, int size);

    TaskPlanDetailVO create(String tenantId, Long userId, UpsertTaskPlanRequest request);

    TaskPlanDetailVO get(String tenantId, Long planId);

    TaskPlanDetailVO update(String tenantId, Long userId, Long planId, UpsertTaskPlanRequest request);

    void delete(String tenantId, Long userId, Long planId);

    TaskPlanPreviewVO preview(String tenantId, TaskPlanPreviewRequest request);

    TaskPlanDetailVO activate(String tenantId, Long userId, Long planId);

    TaskPlanDetailVO pause(String tenantId, Long userId, Long planId);

    TaskPlanDetailVO archive(String tenantId, Long userId, Long planId);

    List<TaskPlanGenerationVO> generations(String tenantId, Long planId);
}
