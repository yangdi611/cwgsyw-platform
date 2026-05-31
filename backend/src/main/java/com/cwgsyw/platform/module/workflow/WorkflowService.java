package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.workflow.dto.*;
import lombok.RequiredArgsConstructor;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.repository.Deployment;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.task.api.Task;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkflowService {
    private final RuntimeService runtimeService;
    private final TaskService taskService;
    private final RepositoryService repositoryService;

    @Transactional
    public String startDailyReportApproval(Long reportId, Long groupId) {
        Map<String, Object> vars = new HashMap<>();
        vars.put("reportId", reportId);
        vars.put("groupId", "group_" + groupId);
        vars.put("approved", false);

        ProcessInstance pi = runtimeService.startProcessInstanceByKey(
            "dailyReportApproval",
            "dailyReport:" + reportId,
            vars
        );
        return pi.getId();
    }

    @Transactional
    public void approve(String taskId, Long approverId, boolean approved, String comment) {
        Task task = taskService.createTaskQuery()
            .taskId(taskId)
            .singleResult();
        if (task == null) throw new IllegalArgumentException("任务不存在: " + taskId);

        String currentAssignee = task.getAssignee();
        String approverStr = String.valueOf(approverId);
        if (currentAssignee != null && !currentAssignee.equals(approverStr)) {
            throw new IllegalArgumentException("该任务已被其他人认领，无法操作");
        }
        if (currentAssignee == null) {
            taskService.claim(taskId, approverStr);
        }

        Map<String, Object> vars = new HashMap<>();
        vars.put("approved", approved);
        if (comment != null) vars.put("comment", comment);

        taskService.complete(taskId, vars);
    }

    public List<TaskVO> getPendingTasksByGroup(Long groupId) {
        String candidateGroup = "group_" + groupId;
        List<Task> tasks = taskService.createTaskQuery()
            .taskCandidateGroup(candidateGroup)
            .orderByTaskCreateTime().desc()
            .list();
        return toVOList(tasks);
    }

    public List<TaskVO> getPendingTasksByUser(Long userId) {
        List<Task> tasks = taskService.createTaskQuery()
            .taskCandidateOrAssigned(String.valueOf(userId))
            .orderByTaskCreateTime().desc()
            .list();
        return toVOList(tasks);
    }

    // ========== Process Definition CRUD ==========

    /**
     * List all process definitions (latest version only)
     */
    public PageResult<ProcessDefinitionVO> listDefinitions(int page, int size) {
        var query = repositoryService.createProcessDefinitionQuery()
            .latestVersion()
            .orderByProcessDefinitionName().asc();
        long total = query.count();
        var definitions = query.listPage((page - 1) * size, size);
        List<ProcessDefinitionVO> vos = definitions.stream().map(def -> {
            var vo = new ProcessDefinitionVO();
            vo.setId(def.getId());
            vo.setName(def.getName());
            vo.setKey(def.getKey());
            vo.setVersion(def.getVersion());
            vo.setDescription(def.getDescription());
            vo.setCategory(def.getCategory());
            vo.setDeploymentId(def.getDeploymentId());
            vo.setSuspended(def.isSuspended());
            vo.setTenantId(def.getTenantId());
            return vo;
        }).toList();
        var result = new PageResult<ProcessDefinitionVO>();
        result.setRecords(vos);
        result.setTotal(total);
        result.setPage(page);
        result.setSize(size);
        return result;
    }

    /**
     * Get process definition detail including BPMN XML
     */
    public ProcessDefinitionDetailVO getDefinition(String definitionId) {
        var def = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(definitionId).singleResult();
        if (def == null) throw new IllegalArgumentException("流程定义不存在: " + definitionId);
        // Get BPMN XML
        var bis = repositoryService.getProcessModel(definitionId);
        String xml;
        try {
            xml = new String(bis.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("读取流程定义XML失败: " + definitionId, e);
        }
        var vo = new ProcessDefinitionDetailVO();
        vo.setId(def.getId());
        vo.setName(def.getName());
        vo.setKey(def.getKey());
        vo.setVersion(def.getVersion());
        vo.setDescription(def.getDescription());
        vo.setCategory(def.getCategory());
        vo.setDeploymentId(def.getDeploymentId());
        vo.setSuspended(def.isSuspended());
        vo.setTenantId(def.getTenantId());
        vo.setXml(xml);
        return vo;
    }

    /**
     * Create/deploy a new process definition
     */
    @Transactional
    public ProcessDefinitionVO createDefinition(SaveProcessDefinitionReq req, String tenantId) {
        long existingCount = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(req.getKey()).count();
        if (existingCount > 0) {
            throw new IllegalArgumentException("流程 Key 已存在: " + req.getKey());
        }
        String resourceName = req.getKey() + ".bpmn20.xml";
        Deployment deployment = repositoryService.createDeployment()
            .name(req.getName())
            .key(req.getKey())
            .category(req.getCategory())
            .tenantId(tenantId)
            .addString(resourceName, req.getXml())
            .deploy();
        var def = repositoryService.createProcessDefinitionQuery()
            .deploymentId(deployment.getId()).singleResult();
        var vo = new ProcessDefinitionVO();
        vo.setId(def.getId());
        vo.setName(def.getName());
        vo.setKey(def.getKey());
        vo.setVersion(def.getVersion());
        vo.setDescription(req.getDescription());
        vo.setCategory(def.getCategory());
        vo.setDeploymentId(deployment.getId());
        vo.setDeploymentTime(deployment.getDeploymentTime().toInstant()
            .atZone(java.time.ZoneId.systemDefault()).toLocalDateTime());
        vo.setSuspended(false);
        vo.setTenantId(tenantId);
        return vo;
    }

    /**
     * Update process definition (new version: suspend old version, deploy new one)
     */
    @Transactional
    public ProcessDefinitionVO updateDefinition(String definitionId, SaveProcessDefinitionReq req, String tenantId) {
        var oldDef = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(definitionId).singleResult();
        if (oldDef == null) throw new IllegalArgumentException("流程定义不存在: " + definitionId);
        // Suspend old version
        repositoryService.suspendProcessDefinitionById(definitionId, true, null);
        // Deploy new version (same key)
        String resourceName = req.getKey() + ".bpmn20.xml";
        Deployment deployment = repositoryService.createDeployment()
            .name(req.getName())
            .key(req.getKey())
            .category(req.getCategory())
            .tenantId(tenantId)
            .addString(resourceName, req.getXml())
            .deploy();
        var newDef = repositoryService.createProcessDefinitionQuery()
            .deploymentId(deployment.getId()).singleResult();
        var vo = new ProcessDefinitionVO();
        vo.setId(newDef.getId());
        vo.setName(newDef.getName());
        vo.setKey(newDef.getKey());
        vo.setVersion(newDef.getVersion());
        vo.setDescription(req.getDescription());
        vo.setCategory(newDef.getCategory());
        vo.setDeploymentId(deployment.getId());
        vo.setDeploymentTime(deployment.getDeploymentTime().toInstant()
            .atZone(java.time.ZoneId.systemDefault()).toLocalDateTime());
        vo.setSuspended(false);
        vo.setTenantId(tenantId);
        return vo;
    }

    /**
     * Delete process definition and all versions
     */
    @Transactional
    public void deleteDefinition(String definitionId) {
        var def = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(definitionId).singleResult();
        if (def == null) throw new IllegalArgumentException("流程定义不存在: " + definitionId);
        // Cascade delete: removes all versions + runtime instances + history
        repositoryService.deleteDeployment(def.getDeploymentId(), true);
    }

    /**
     * Get all historical versions for a key
     */
    public List<ProcessDefinitionVO> getDefinitionVersions(String key) {
        return repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(key)
            .orderByProcessDefinitionVersion().desc()
            .list().stream().map(def -> {
                var vo = new ProcessDefinitionVO();
                vo.setId(def.getId());
                vo.setName(def.getName());
                vo.setKey(def.getKey());
                vo.setVersion(def.getVersion());
                vo.setDescription(def.getDescription());
                vo.setCategory(def.getCategory());
                vo.setDeploymentId(def.getDeploymentId());
                vo.setSuspended(def.isSuspended());
                vo.setTenantId(def.getTenantId());
                return vo;
            }).toList();
    }

    private List<TaskVO> toVOList(List<Task> tasks) {
        if (tasks.isEmpty()) return List.of();
        Set<String> piIds = tasks.stream()
            .map(Task::getProcessInstanceId)
            .collect(java.util.stream.Collectors.toSet());
        Map<String, String> businessKeyMap = runtimeService
            .createProcessInstanceQuery()
            .processInstanceIds(piIds)
            .list()
            .stream()
            .collect(java.util.stream.Collectors.toMap(
                pi -> pi.getId(),
                pi -> pi.getBusinessKey() != null ? pi.getBusinessKey() : ""
            ));
        return tasks.stream()
            .map(task -> toVO(task, businessKeyMap.getOrDefault(task.getProcessInstanceId(), "")))
            .collect(java.util.stream.Collectors.toList());
    }

    private TaskVO toVO(Task task, String businessKey) {
        TaskVO vo = new TaskVO();
        vo.setTaskId(task.getId());
        vo.setProcessInstanceId(task.getProcessInstanceId());
        vo.setTaskName(task.getName());
        vo.setAssignee(task.getAssignee());
        vo.setCreateTime(task.getCreateTime() != null
            ? task.getCreateTime().toInstant()
                .atZone(java.time.ZoneId.systemDefault())
                .toLocalDateTime()
            : null);
        vo.setBusinessKey(businessKey);
        if (businessKey.startsWith("dailyReport:")) {
            String[] parts = businessKey.split(":", 2);
            if (parts.length == 2 && !parts[1].isEmpty()) {
                vo.setBusinessType("daily_report");
                vo.setBusinessId(Long.parseLong(parts[1]));
            }
        }
        return vo;
    }
}
