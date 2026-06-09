package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.config.SysConfigService;
import com.cwgsyw.platform.module.workflow.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.cwgsyw.platform.module.workflow.dto.InstanceVO;
import com.cwgsyw.platform.module.workflow.dto.StartProcessRequest;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/workflow")
@RequiredArgsConstructor
public class WorkflowController {
    private final WorkflowService workflowService;
    private final AuditLogMapper auditLogMapper;
    private final SysConfigService configService;

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

    // ========== Process Stats ==========

    /**
     * 流程统计（所有流程）
     */
    @GetMapping("/stats")
    @PreAuthorize("hasPermission('workflow', 'read')")
    public R<List<Map<String, Object>>> allStats() {
        return R.ok(workflowService.getAllProcessStats());
    }

    /**
     * 单个流程统计
     */
    @GetMapping("/stats/{key}")
    @PreAuthorize("hasPermission('workflow', 'read')")
    public R<Map<String, Object>> processStats(@PathVariable String key) {
        return R.ok(workflowService.getProcessStats(key));
    }

    /**
     * 更新流程定义（通过 key，避免 ID 中冒号的 URL 编码问题）
     */
    @PutMapping("/definitions/key/{key}/update")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<ProcessDefinitionVO> updateByKey(
            @PathVariable String key,
            @RequestBody SaveProcessDefinitionReq req,
            @AuthenticationPrincipal SecurityUser cu) {
        var latest = workflowService.listDefinitions(1, 100).getRecords().stream()
            .filter(d -> d.getKey().equals(key)).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("流程定义不存在: " + key));
        ProcessDefinitionVO vo = workflowService.updateDefinition(latest.getId(), req, cu.getTenantId());
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(cu.getTenantId()).module("workflow").action("update_definition")
            .targetId(0L).targetType("process_definition").operatorId(cu.getUserId())
            .afterJson("{\"key\":\"" + vo.getKey() + "\",\"version\":" + vo.getVersion() + "}")
            .remark("更新流程定义: " + vo.getName() + " v" + vo.getVersion()).build());
        return R.ok(vo);
    }

    /**
     * 激活（取消挂起）指定版本 — 互斥：自动挂起同流程下其他版本
     */
    @PutMapping("/definitions/{id}/activate")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<Void> activateDefinition(@PathVariable String id) {
        workflowService.activateDefinition(id);
        return R.ok();
    }

    /**
     * 挂起（禁用）指定版本
     */
    @PutMapping("/definitions/{id}/suspend")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<Void> suspendDefinition(@PathVariable String id) {
        workflowService.suspendDefinition(id);
        return R.ok();
    }

    /**
     * 删除单个版本（含绑定保护）
     * 使用 @RequestBody 避免 URL 路径中 definitionId 含冒号导致 Servlet 容器拦截
     */
    @PostMapping("/definitions/delete-version")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<Void> deleteVersion(@RequestBody Map<String, String> body,
                                  @AuthenticationPrincipal SecurityUser cu) {
        String definitionId = body.get("definition_id");
        if (definitionId == null || definitionId.isBlank()) {
            return R.fail("缺少 definition_id 参数");
        }
        // Check if this version is bound to any business module via sys_config
        Map<String, String> cfg = configService.getAll(cu.getTenantId());
        java.util.List<String> bindingKeys = java.util.List.of(
            "daily_report_process_definition_id",
            "change_doc_process_definition_id",
            "device_access_process_definition_id"
        );
        java.util.List<String> bindingNames = java.util.List.of(
            "日报审批", "变更文档审批", "设备权限审批"
        );
        for (int i = 0; i < bindingKeys.size(); i++) {
            String boundId = cfg.get(bindingKeys.get(i));
            if (definitionId.equals(boundId)) {
                return R.fail("该版本已被【" + bindingNames.get(i) + "】流程绑定，请先在系统配置中更换绑定");
            }
        }
        var def = workflowService.getDefinition(definitionId);
        workflowService.deleteDefinitionVersion(definitionId);
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(cu.getTenantId()).module("workflow").action("delete_version")
            .targetId(0L).targetType("process_definition").operatorId(cu.getUserId())
            .beforeJson("{\"key\":\"" + def.getKey() + "\",\"version\":" + def.getVersion() + "}")
            .remark("删除流程版本: " + def.getName() + " v" + def.getVersion()).build());
        return R.ok();
    }

    /**
     * 流程所有历史版本
     */
    @GetMapping("/definitions/key/{key}/versions")
    @PreAuthorize("hasPermission('workflow', 'read')")
    public R<List<ProcessDefinitionVO>> definitionVersions(@PathVariable String key) {
        return R.ok(workflowService.getDefinitionVersions(key));
    }

    // ========== Process Instance Management ==========

    /**
     * 启动流程实例
     */
    @PostMapping("/instances")
    @PreAuthorize("hasPermission('workflow', 'read')")
    public R<InstanceVO> startProcess(@RequestBody StartProcessRequest req,
                                       @AuthenticationPrincipal SecurityUser cu) {
        InstanceVO vo = workflowService.startProcess(req, cu.getUserId(), cu.getTenantId());
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(cu.getTenantId())
            .module("workflow")
            .action("start_process")
            .targetId(0L)
            .targetType("process_instance")
            .operatorId(cu.getUserId())
            .afterJson("{\"instanceId\":\"" + vo.getId() + "\",\"key\":\"" + req.getProcessDefinitionKey() + "\"}")
            .remark("启动流程: " + req.getProcessDefinitionKey())
            .build());
        return R.ok(vo);
    }

    /**
     * 运行中的流程实例
     */
    @GetMapping("/instances/running")
    @PreAuthorize("hasPermission('workflow', 'read')")
    public R<PageResult<InstanceVO>> runningInstances(
            @RequestParam(required = false) String key,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return R.ok(workflowService.listRunningInstances(key, page, size));
    }

    /**
     * 已完成的流程实例
     */
    @GetMapping("/instances/finished")
    @PreAuthorize("hasPermission('workflow', 'read')")
    public R<PageResult<InstanceVO>> finishedInstances(
            @RequestParam(required = false) String key,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return R.ok(workflowService.listFinishedInstances(key, page, size));
    }

    /**
     * 挂起流程实例
     */
    @PutMapping("/instances/{id}/suspend")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<Void> suspendInstance(@PathVariable String id) {
        workflowService.suspendInstance(id);
        return R.ok();
    }

    /**
     * 激活流程实例
     */
    @PutMapping("/instances/{id}/activate")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<Void> activateInstance(@PathVariable String id) {
        workflowService.activateInstance(id);
        return R.ok();
    }

    /**
     * 终止流程实例
     */
    @DeleteMapping("/instances/{id}")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<Void> deleteInstance(@PathVariable String id,
                                   @RequestParam(defaultValue = "手动终止") String reason,
                                   @AuthenticationPrincipal SecurityUser cu) {
        workflowService.deleteInstance(id, reason);
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(cu.getTenantId())
            .module("workflow")
            .action("delete_instance")
            .targetId(0L)
            .targetType("process_instance")
            .operatorId(cu.getUserId())
            .remark("终止流程实例: " + id + " reason=" + reason)
            .build());
        return R.ok();
    }

    /**
     * 流程实例历史活动（用于流程图高亮）
     */
    @GetMapping("/instances/{id}/activities")
    @PreAuthorize("hasPermission('workflow', 'read')")
    public R<List<Map<String, Object>>> activities(@PathVariable String id) {
        return R.ok(workflowService.getHistoricActivities(id));
    }
}
