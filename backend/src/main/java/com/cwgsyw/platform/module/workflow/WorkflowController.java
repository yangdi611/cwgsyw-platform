package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.common.entity.AuditLog;
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
    private final AuditLogMapper auditLogMapper;

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

    /**
     * 流程定义列表
     */
    @GetMapping("/definitions")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<PageResult<ProcessDefinitionVO>> listDefinitions(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return R.ok(workflowService.listDefinitions(page, size));
    }

    /**
     * 流程定义详情（含 BPMN XML）
     */
    @GetMapping("/definitions/{definitionId}")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<ProcessDefinitionDetailVO> getDefinition(@PathVariable String definitionId) {
        return R.ok(workflowService.getDefinition(definitionId));
    }

    /**
     * 创建/部署流程定义
     */
    @PostMapping("/definitions")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<ProcessDefinitionVO> createDefinition(
            @RequestBody SaveProcessDefinitionReq req,
            @AuthenticationPrincipal SecurityUser cu) {
        ProcessDefinitionVO vo = workflowService.createDefinition(req, cu.getTenantId());
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(cu.getTenantId())
            .module("workflow")
            .action("create_definition")
            .targetId(0L)
            .targetType("process_definition")
            .operatorId(cu.getUserId())
            .afterJson("{\"key\":\"" + vo.getKey() + "\",\"name\":\"" + vo.getName() + "\"}")
            .remark("部署流程定义: " + vo.getName())
            .build());
        return R.ok(vo);
    }

    /**
     * 更新流程定义（新版本）
     */
    @PutMapping("/definitions/{definitionId}")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<ProcessDefinitionVO> updateDefinition(
            @PathVariable String definitionId,
            @RequestBody SaveProcessDefinitionReq req,
            @AuthenticationPrincipal SecurityUser cu) {
        ProcessDefinitionVO vo = workflowService.updateDefinition(definitionId, req, cu.getTenantId());
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(cu.getTenantId())
            .module("workflow")
            .action("update_definition")
            .targetId(0L)
            .targetType("process_definition")
            .operatorId(cu.getUserId())
            .afterJson("{\"key\":\"" + vo.getKey() + "\",\"version\":" + vo.getVersion() + "}")
            .remark("更新流程定义: " + vo.getName() + " v" + vo.getVersion())
            .build());
        return R.ok(vo);
    }

    /**
     * 删除流程定义（所有版本）
     */
    @DeleteMapping("/definitions/{definitionId}")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<Void> deleteDefinition(
            @PathVariable String definitionId,
            @AuthenticationPrincipal SecurityUser cu) {
        var def = workflowService.getDefinition(definitionId);
        workflowService.deleteDefinition(definitionId);
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(cu.getTenantId())
            .module("workflow")
            .action("delete_definition")
            .targetId(0L)
            .targetType("process_definition")
            .operatorId(cu.getUserId())
            .beforeJson("{\"key\":\"" + def.getKey() + "\",\"name\":\"" + def.getName() + "\"}")
            .remark("删除流程定义: " + def.getName())
            .build());
        return R.ok();
    }
}
