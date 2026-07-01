package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.workflow.binding.ProcessBindingService;
import com.cwgsyw.platform.module.workflow.binding.WorkflowProcessBinding;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowRuntimeFacade;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowTaskCompleteCommand;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowTaskSummary;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 统一流程中心 API：业务待办、审批、绑定管理。
 *
 * <p>与旧 {@code WorkflowController} 并存：旧接口服务既有日报页面，本控制器提供
 * 带业务摘要的统一待办中心与绑定管理。均复用现有权限码。
 */
@RestController
@RequestMapping("/api/workflow/center")
@RequiredArgsConstructor
public class WorkflowCenterController {

    private final WorkflowRuntimeFacade runtimeFacade;
    private final ProcessBindingService bindingService;

    // ── 待办中心 ──────────────────────────────────────────────────────────

    /** 我的待办（含业务摘要）。 */
    @GetMapping("/tasks/my")
    @PreAuthorize("hasPermission('workflow', 'read')")
    public R<List<WorkflowTaskSummary>> myTasks(@AuthenticationPrincipal SecurityUser cu) {
        return R.ok(runtimeFacade.listMyTasks(cu));
    }

    /** 组待办（含业务摘要）。 */
    @GetMapping("/tasks/group")
    @PreAuthorize("hasPermission('workflow', 'read')")
    public R<List<WorkflowTaskSummary>> groupTasks(@AuthenticationPrincipal SecurityUser cu) {
        return R.ok(runtimeFacade.listGroupTasks(cu));
    }

    /** 完成审批任务（权限门控由 facade 内 adapter.canApprove 复核）。 */
    @PostMapping("/tasks/complete")
    @PreAuthorize("hasPermission('workflow', 'read')")
    public R<Void> complete(@RequestBody CompleteTaskRequest req,
                            @AuthenticationPrincipal SecurityUser cu) {
        runtimeFacade.completeTask(WorkflowTaskCompleteCommand.builder()
            .tenantId(cu.getTenantId())
            .taskId(req.getTaskId())
            .operatorId(cu.getUserId())
            .approved(req.isApproved())
            .comment(req.getComment())
            .build());
        return R.ok();
    }

    // ── 绑定管理 ──────────────────────────────────────────────────────────

    /** 列出当前租户的业务流程绑定。 */
    @GetMapping("/bindings")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<List<WorkflowProcessBinding>> listBindings(@AuthenticationPrincipal SecurityUser cu) {
        return R.ok(bindingService.listBindings(cu.getTenantId()));
    }

    /** 绑定业务类型到指定流程定义版本。 */
    @PostMapping("/bindings")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<WorkflowProcessBinding> bind(@RequestBody BindRequest req,
                                          @AuthenticationPrincipal SecurityUser cu) {
        // 绑定前校验可绑定性，失败抛出可读原因
        bindingService.validateBindable(cu.getTenantId(), req.getBusinessType(), req.getProcessDefinitionId());
        return R.ok(bindingService.bind(cu.getTenantId(), req.getBusinessType(),
            req.getProcessDefinitionId(), req.getTemplateInstanceId(), cu.getUserId(), req.getRemark()));
    }

    @Data
    public static class CompleteTaskRequest {
        private String taskId;
        private boolean approved;
        private String comment;
    }

    @Data
    public static class BindRequest {
        private String businessType;
        private String processDefinitionId;
        private Long templateInstanceId;
        private String remark;
    }
}
