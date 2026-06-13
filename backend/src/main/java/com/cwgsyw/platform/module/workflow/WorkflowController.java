package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.workflow.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/workflow")
@RequiredArgsConstructor
public class WorkflowController {
    private final WorkflowService workflowService;

    @GetMapping("/tasks/my")
    @PreAuthorize("hasPermission('workflow', 'read')")
    public R<List<TaskVO>> myTasks(@AuthenticationPrincipal SecurityUser cu) {
        return R.ok(workflowService.getPendingTasksByUser(cu.getUserId()));
    }

    @GetMapping("/tasks/group")
    @PreAuthorize("hasPermission('daily_report', 'approve')")
    public R<List<TaskVO>> groupTasks(@AuthenticationPrincipal SecurityUser cu) {
        return R.ok(workflowService.getPendingTasksByGroup(cu.getGroupId()));
    }

    @PostMapping("/approve")
    @PreAuthorize("hasPermission('daily_report', 'approve')")
    public R<Void> approve(@Valid @RequestBody ApproveRequest req,
                           @AuthenticationPrincipal SecurityUser cu) {
        workflowService.approve(req.getTaskId(), cu.getUserId(),
            req.isApproved(), req.getComment());
        return R.ok();
    }
}
