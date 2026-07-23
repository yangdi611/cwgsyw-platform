package com.cwgsyw.platform.module.task.automation;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.task.automation.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/task-automations")
@RequiredArgsConstructor
public class TaskAutomationController {
    private final TaskAutomationService service;

    @GetMapping @PreAuthorize("hasAuthority('task_analytics:read')")
    public R<List<AutomationRuleVO>> list(@AuthenticationPrincipal SecurityUser user) { return R.ok(service.list(user)); }
    @PostMapping @PreAuthorize("hasAuthority('task_analytics:create')")
    public R<AutomationRuleVO> create(@Valid @RequestBody AutomationRuleRequest request, @AuthenticationPrincipal SecurityUser user) { return R.ok(service.create(user, request)); }
    @GetMapping("/{ruleId}") @PreAuthorize("hasAuthority('task_analytics:read')")
    public R<AutomationRuleVO> get(@PathVariable Long ruleId, @AuthenticationPrincipal SecurityUser user) { return R.ok(service.get(user, ruleId)); }
    @PutMapping("/{ruleId}") @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<AutomationRuleVO> update(@PathVariable Long ruleId, @Valid @RequestBody AutomationRuleRequest request, @AuthenticationPrincipal SecurityUser user) { return R.ok(service.update(user, ruleId, request)); }
    @DeleteMapping("/{ruleId}") @PreAuthorize("hasAuthority('task_analytics:delete')")
    public R<Void> delete(@PathVariable Long ruleId, @AuthenticationPrincipal SecurityUser user) { service.delete(user, ruleId); return R.ok(); }
    @PostMapping("/{ruleId}/activate") @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<AutomationRuleVO> activate(@PathVariable Long ruleId, @AuthenticationPrincipal SecurityUser user) { return R.ok(service.activate(user, ruleId)); }
    @PostMapping("/{ruleId}/pause") @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<AutomationRuleVO> pause(@PathVariable Long ruleId, @AuthenticationPrincipal SecurityUser user) { return R.ok(service.pause(user, ruleId)); }
    @GetMapping("/{ruleId}/executions") @PreAuthorize("hasAuthority('task_analytics:read')")
    public R<List<AutomationExecutionVO>> executions(@PathVariable Long ruleId, @AuthenticationPrincipal SecurityUser user) { return R.ok(service.executions(user, ruleId)); }
    @PostMapping("/executions/{executionId}/retry") @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<Void> retry(@PathVariable Long executionId, @AuthenticationPrincipal SecurityUser user) { service.retry(user, executionId); return R.ok(); }
    @PostMapping("/{ruleId}/preview") @PreAuthorize("hasAuthority('task_analytics:read')")
    public R<AutomationPreviewVO> preview(@PathVariable Long ruleId, @Valid @RequestBody AutomationPreviewRequest request, @AuthenticationPrincipal SecurityUser user) { return R.ok(service.preview(user, ruleId, request)); }
}
