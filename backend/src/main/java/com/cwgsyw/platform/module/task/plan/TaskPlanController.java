package com.cwgsyw.platform.module.task.plan;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.task.plan.dto.TaskPlanDetailVO;
import com.cwgsyw.platform.module.task.plan.dto.TaskPlanGenerationVO;
import com.cwgsyw.platform.module.task.plan.dto.TaskPlanPreviewRequest;
import com.cwgsyw.platform.module.task.plan.dto.TaskPlanPreviewVO;
import com.cwgsyw.platform.module.task.plan.dto.TaskPlanSummaryVO;
import com.cwgsyw.platform.module.task.plan.dto.UpsertTaskPlanRequest;
import com.cwgsyw.platform.module.task.plan.service.TaskPlanService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/task-plans")
@RequiredArgsConstructor
public class TaskPlanController {
    private final TaskPlanService planService;

    @GetMapping
    @PreAuthorize("hasAuthority('task_plan:read')")
    public R<PageResult<TaskPlanSummaryVO>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(planService.list(user.getTenantId(), keyword, status, page, size));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('task_plan:create')")
    public R<TaskPlanDetailVO> create(@Valid @RequestBody UpsertTaskPlanRequest request,
                                      @AuthenticationPrincipal SecurityUser user) {
        return R.ok(planService.create(user.getTenantId(), user.getUserId(), request));
    }

    @GetMapping("/{planId}")
    @PreAuthorize("hasAuthority('task_plan:read')")
    public R<TaskPlanDetailVO> get(@PathVariable Long planId,
                                   @AuthenticationPrincipal SecurityUser user) {
        return R.ok(planService.get(user.getTenantId(), planId));
    }

    @PutMapping("/{planId}")
    @PreAuthorize("hasAuthority('task_plan:update')")
    public R<TaskPlanDetailVO> update(@PathVariable Long planId,
                                      @Valid @RequestBody UpsertTaskPlanRequest request,
                                      @AuthenticationPrincipal SecurityUser user) {
        return R.ok(planService.update(user.getTenantId(), user.getUserId(), planId, request));
    }

    @DeleteMapping("/{planId}")
    @PreAuthorize("hasAuthority('task_plan:delete')")
    public R<Void> delete(@PathVariable Long planId,
                          @AuthenticationPrincipal SecurityUser user) {
        planService.delete(user.getTenantId(), user.getUserId(), planId);
        return R.ok();
    }

    @PostMapping("/preview")
    @PreAuthorize("hasAuthority('task_plan:read')")
    public R<TaskPlanPreviewVO> preview(@Valid @RequestBody TaskPlanPreviewRequest request,
                                        @AuthenticationPrincipal SecurityUser user) {
        return R.ok(planService.preview(user.getTenantId(), request));
    }

    @PostMapping("/{planId}/activate")
    @PreAuthorize("hasAuthority('task_plan:activate')")
    public R<TaskPlanDetailVO> activate(@PathVariable Long planId,
                                        @AuthenticationPrincipal SecurityUser user) {
        return R.ok(planService.activate(user.getTenantId(), user.getUserId(), planId));
    }

    @PostMapping("/{planId}/pause")
    @PreAuthorize("hasAuthority('task_plan:activate')")
    public R<TaskPlanDetailVO> pause(@PathVariable Long planId,
                                     @AuthenticationPrincipal SecurityUser user) {
        return R.ok(planService.pause(user.getTenantId(), user.getUserId(), planId));
    }

    @PostMapping("/{planId}/archive")
    @PreAuthorize("hasAuthority('task_plan:delete')")
    public R<TaskPlanDetailVO> archive(@PathVariable Long planId,
                                       @AuthenticationPrincipal SecurityUser user) {
        return R.ok(planService.archive(user.getTenantId(), user.getUserId(), planId));
    }

    @GetMapping("/{planId}/generations")
    @PreAuthorize("hasAuthority('task_plan:read')")
    public R<List<TaskPlanGenerationVO>> generations(@PathVariable Long planId,
                                                      @AuthenticationPrincipal SecurityUser user) {
        return R.ok(planService.generations(user.getTenantId(), planId));
    }
}
