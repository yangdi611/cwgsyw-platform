package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.workflow.binding.ProcessBindingService;
import com.cwgsyw.platform.module.workflow.binding.WorkflowProcessBinding;
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
 * <p>提供流程绑定管理。用户待办和审批统一由任务工作台处理。
 */
@RestController
@RequestMapping("/api/workflow/center")
@RequiredArgsConstructor
public class WorkflowCenterController {

    private final ProcessBindingService bindingService;

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

    @PostMapping("/bindings/{bindingId}/enable")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<WorkflowProcessBinding> enableBinding(@PathVariable Long bindingId,
                                                    @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(bindingService.enable(cu.getTenantId(), bindingId, cu.getUserId()));
    }

    @PostMapping("/bindings/{bindingId}/disable")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<WorkflowProcessBinding> disableBinding(@PathVariable Long bindingId,
                                                     @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(bindingService.disable(cu.getTenantId(), bindingId, cu.getUserId()));
    }

    @DeleteMapping("/bindings/{bindingId}")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<Void> deleteBinding(@PathVariable Long bindingId,
                                 @AuthenticationPrincipal SecurityUser cu) {
        bindingService.delete(cu.getTenantId(), bindingId, cu.getUserId());
        return R.ok();
    }

    @Data
    public static class BindRequest {
        private String businessType;
        private String processDefinitionId;
        private Long templateInstanceId;
        private String remark;
    }
}
