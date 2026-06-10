package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.workflow.dto.*;
import lombok.RequiredArgsConstructor;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.HistoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.history.HistoricProcessInstance;
import org.flowable.engine.repository.Deployment;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.task.api.Task;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkflowService {
    private final RuntimeService runtimeService;
    private final TaskService taskService;
    private final RepositoryService repositoryService;
    private final HistoryService historyService;
    private final JdbcTemplate jdbcTemplate;

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
        // Batch load deployment times
        Set<String> deploymentIds = vos.stream().map(ProcessDefinitionVO::getDeploymentId).collect(Collectors.toSet());
        Map<String, LocalDateTime> deploymentTimeMap = deploymentIds.isEmpty() ? Map.of() :
            repositoryService.createDeploymentQuery().deploymentIds(new ArrayList<>(deploymentIds)).list().stream()
                .collect(Collectors.toMap(org.flowable.engine.repository.Deployment::getId,
                    d -> d.getDeploymentTime().toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime()));
        vos.forEach(vo -> vo.setDeploymentTime(deploymentTimeMap.get(vo.getDeploymentId())));
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
        String xml;
        try (var bis = repositoryService.getProcessModel(definitionId)) {
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
        // Replace the process id in the BPMN XML with the user's desired key.
        // Flowable derives the process definition key from <process id="...">,
        // not from the deployment properties. Without this, every new process
        // would use "Process_1" from the editor template.
        String xml = req.getXml().replaceFirst(
            "<bpmn:process id=\"Process_1\"",
            "<bpmn:process id=\"" + req.getKey() + "\"");
        String resourceName = req.getKey() + ".bpmn20.xml";
        Deployment deployment = repositoryService.createDeployment()
            .name(req.getName())
            .category(req.getCategory())
            .addString(resourceName, xml)
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
     * Update process definition — deploys a new version.
     * Flowable automatically uses the latest version when starting by key,
     * so we don't need to suspend/deprecate old versions.
     */
    @Transactional
    public ProcessDefinitionVO updateDefinition(String definitionId, SaveProcessDefinitionReq req, String tenantId) {
        var oldDef = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(definitionId).singleResult();
        if (oldDef == null) throw new IllegalArgumentException("流程定义不存在: " + definitionId);

        // Read the existing BPMN to extract its targetNamespace
        String existingXml;
        try (var bis = repositoryService.getProcessModel(definitionId)) {
            existingXml = new String(bis.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("读取流程定义XML失败", e);
        }
        // Extract targetNamespace from existing XML and apply it to the new XML
        var nsMatcher = java.util.regex.Pattern.compile("targetNamespace=\"([^\"]+)\"").matcher(existingXml);
        String oldNs = nsMatcher.find() ? nsMatcher.group(1) : null;
        // Preserve existing targetNamespace so Flowable recognises this as a new version
        String newXml = req.getXml();
        // Inject the correct process key — editor template always uses id="Process_1"
        newXml = newXml.replaceFirst("<bpmn:process id=\"[^\"]*\"",
            "<bpmn:process id=\"" + oldDef.getKey() + "\"");
        if (oldNs != null && !oldNs.isEmpty()) {
            newXml = newXml.replaceAll("targetNamespace=\"[^\"]*\"", "targetNamespace=\"" + oldNs + "\"");
        }

        String resourceName = req.getKey() + ".bpmn20.xml";
        Deployment deployment = repositoryService.createDeployment()
            .name(req.getName())
            .category(req.getCategory())
            .addString(resourceName, newXml)
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
     * Delete a single version of a process definition.
     * Fails if this is the last version or if it is bound to a business module.
     */
    @Transactional
    public void deleteDefinitionVersion(String definitionId) {
        var def = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(definitionId).singleResult();
        if (def == null) throw new IllegalArgumentException("流程定义不存在: " + definitionId);
        // Protect: don't allow deleting the last version
        long versionCount = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(def.getKey()).count();
        if (versionCount <= 1) {
            throw new IllegalArgumentException("至少保留一个版本，无法删除");
        }
        // Cascade delete: removes this version's runtime instances + history
        repositoryService.deleteDeployment(def.getDeploymentId(), true);
    }

    /**
     * Activate a suspended definition version — makes it available to start.
     * MUTEX: suspends all other versions of the same process key so that
     * only one version can be active at a time.
     */
    @Transactional
    public void activateDefinition(String definitionId) {
        var def = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(definitionId).singleResult();
        if (def == null) throw new IllegalArgumentException("流程定义不存在: " + definitionId);
        // Suspend all other versions of the same key first (mutex)
        repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(def.getKey())
            .list().stream()
            .filter(d -> !d.getId().equals(definitionId) && !d.isSuspended())
            .forEach(d -> repositoryService.suspendProcessDefinitionById(d.getId(), true, null));
        // Then activate the target version
        repositoryService.activateProcessDefinitionById(definitionId, true, null);
    }

    /**
     * Suspend (deactivate) a definition version.
     */
    @Transactional
    public void suspendDefinition(String definitionId) {
        repositoryService.suspendProcessDefinitionById(definitionId, true, null);
    }

    /**
     * Get all historical versions for a key
     */
    public List<ProcessDefinitionVO> getDefinitionVersions(String key) {
        List<ProcessDefinitionVO> vos = repositoryService.createProcessDefinitionQuery()
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
        // Batch load deployment times
        Set<String> deploymentIds = vos.stream().map(ProcessDefinitionVO::getDeploymentId).collect(Collectors.toSet());
        Map<String, LocalDateTime> deploymentTimeMap = deploymentIds.isEmpty() ? Map.of() :
            repositoryService.createDeploymentQuery().deploymentIds(new ArrayList<>(deploymentIds)).list().stream()
                .collect(Collectors.toMap(org.flowable.engine.repository.Deployment::getId,
                    d -> d.getDeploymentTime().toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime()));
        vos.forEach(vo -> vo.setDeploymentTime(deploymentTimeMap.get(vo.getDeploymentId())));
        return vos;
    }

    // ========== Process Stats ==========

    /**
     * Get statistics for a process definition key
     */
    public Map<String, Object> getProcessStats(String processDefinitionKey) {
        // Running instances
        long runningCount = runtimeService.createProcessInstanceQuery()
            .processDefinitionKey(processDefinitionKey).count();

        // Finished instances
        long finishedCount = historyService.createHistoricProcessInstanceQuery()
            .processDefinitionKey(processDefinitionKey).finished().count();

        // Average duration (in seconds)
        double avgDurationSec = 0;
        if (finishedCount > 0) {
            var finished = historyService.createHistoricProcessInstanceQuery()
                .processDefinitionKey(processDefinitionKey).finished()
                .orderByProcessInstanceEndTime().desc()
                .listPage(0, 100);
            avgDurationSec = finished.stream()
                .filter(pi -> pi.getDurationInMillis() != null)
                .mapToLong(org.flowable.engine.history.HistoricProcessInstance::getDurationInMillis)
                .average()
                .orElse(0) / 1000.0;
        }

        // Success rate: finished / total started * 100
        long totalStarted = runningCount + finishedCount;
        double successRate = totalStarted > 0 ? (double) finishedCount / totalStarted * 100 : 0;

        Map<String, Object> stats = new HashMap<>();
        stats.put("process_definition_key", processDefinitionKey);
        stats.put("total_started", totalStarted);
        stats.put("running_count", runningCount);
        stats.put("finished_count", finishedCount);
        stats.put("success_rate", Math.round(successRate * 10) / 10.0); // 1 decimal
        stats.put("avg_duration_seconds", Math.round(avgDurationSec * 10) / 10.0);
        return stats;
    }

    /**
     * Get stats for all process definitions
     */
    public List<Map<String, Object>> getAllProcessStats() {
        return repositoryService.createProcessDefinitionQuery().latestVersion().list().stream()
            .map(def -> {
                Map<String, Object> stats = getProcessStats(def.getKey());
                stats.put("name", def.getName());
                stats.put("version", def.getVersion());
                stats.put("process_definition_id", def.getId());
                return stats;
            }).toList();
    }

    // ========== Generic Process Instance Management ==========

    private LocalDateTime dateToLocal(java.util.Date d) {
        return d != null ? d.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime() : null;
    }

    /**
     * Generic process start — by definition ID (specific version) or by key (latest version)
     */
    @Transactional
    public InstanceVO startProcess(StartProcessRequest req, Long userId, String tenantId) {
        Map<String, Object> vars = req.getVariables() != null ? req.getVariables() : new HashMap<>();
        ProcessInstance pi;
        if (req.getProcessDefinitionId() != null && !req.getProcessDefinitionId().isBlank()) {
            pi = runtimeService.startProcessInstanceById(
                req.getProcessDefinitionId(), req.getBusinessKey(), vars);
        } else {
            pi = runtimeService.startProcessInstanceByKey(
                req.getProcessDefinitionKey(), req.getBusinessKey(), vars);
        }
        return toInstanceVO(pi);
    }

    /**
     * List running process instances
     */
    public PageResult<InstanceVO> listRunningInstances(String key, int page, int size) {
        var query = runtimeService.createProcessInstanceQuery();
        if (key != null && !key.isEmpty()) query.processDefinitionKey(key);
        query.orderByStartTime().desc();
        long total = query.count();
        var pis = query.listPage((page - 1) * size, size);
        var result = new PageResult<InstanceVO>();
        result.setRecords(pis.stream().map(this::toInstanceVO).toList());
        result.setTotal(total);
        result.setPage(page);
        result.setSize(size);
        return result;
    }

    /**
     * Suspend process instance
     */
    @Transactional
    public void suspendInstance(String instanceId) {
        runtimeService.suspendProcessInstanceById(instanceId);
    }

    /**
     * Activate process instance
     */
    @Transactional
    public void activateInstance(String instanceId) {
        runtimeService.activateProcessInstanceById(instanceId);
    }

    /**
     * Delete (terminate) process instance
     */
    @Transactional
    public void deleteInstance(String instanceId, String reason) {
        runtimeService.deleteProcessInstance(instanceId, reason);
    }

    /**
     * List finished (historical) process instances
     */
    public PageResult<InstanceVO> listFinishedInstances(String key, int page, int size) {
        var query = historyService.createHistoricProcessInstanceQuery().finished();
        if (key != null && !key.isEmpty()) query.processDefinitionKey(key);
        query.orderByProcessInstanceEndTime().desc();
        long total = query.count();
        var pis = query.listPage((page - 1) * size, size);
        var result = new PageResult<InstanceVO>();
        result.setRecords(pis.stream().map(hpi -> {
            var vo = new InstanceVO();
            vo.setId(hpi.getId());
            vo.setBusinessKey(hpi.getBusinessKey());
            vo.setProcessDefinitionName(hpi.getProcessDefinitionName());
            vo.setProcessDefinitionKey(hpi.getProcessDefinitionKey());
            vo.setStartTime(dateToLocal(hpi.getStartTime()));
            vo.setEndTime(dateToLocal(hpi.getEndTime()));
            vo.setEnded(true);
            return vo;
        }).toList());
        result.setTotal(total);
        result.setPage(page);
        result.setSize(size);
        return result;
    }

    /**
     * Get historic activities for process diagram highlighting
     */
    public List<Map<String, Object>> getHistoricActivities(String instanceId) {
        return historyService.createHistoricActivityInstanceQuery()
            .processInstanceId(instanceId)
            .orderByHistoricActivityInstanceStartTime().asc()
            .list().stream().map(a -> {
                Map<String, Object> m = new java.util.HashMap<>();
                m.put("activity_id", a.getActivityId());
                m.put("activity_name", a.getActivityName());
                m.put("activity_type", a.getActivityType());
                m.put("start_time", dateToLocal(a.getStartTime()));
                m.put("end_time", dateToLocal(a.getEndTime()));
                m.put("assignee", a.getAssignee() != null ? a.getAssignee() : "");
                return m;
            }).toList();
    }

    /**
     * Update process definition name and/or key for all versions of a process.
     * Uses JdbcTemplate for direct DB updates since Flowable has no API for this.
     */
    @Transactional
    public ProcessDefinitionVO renameDefinition(String definitionId, UpdateProcessMetaReq req) {
        var def = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(definitionId).singleResult();
        if (def == null) throw new IllegalArgumentException("流程定义不存在: " + definitionId);

        String oldKey = def.getKey();
        String newKey = req.getKey() != null && !req.getKey().isBlank() ? req.getKey().trim() : oldKey;
        String newName = req.getName() != null && !req.getName().isBlank() ? req.getName().trim() : null;

        if (newKey.equals(oldKey) && newName == null) {
            throw new IllegalArgumentException("至少需要提供 name 或 key");
        }

        // Check key uniqueness if changing key
        if (!newKey.equals(oldKey)) {
            long existing = repositoryService.createProcessDefinitionQuery()
                .processDefinitionKey(newKey).count();
            if (existing > 0) {
                throw new IllegalArgumentException("流程 Key 已存在: " + newKey);
            }
        }

        // Update name in ACT_RE_PROCDEF and ACT_RE_DEPLOYMENT
        if (newName != null) {
            jdbcTemplate.update("UPDATE ACT_RE_PROCDEF SET NAME_ = ? WHERE KEY_ = ?", newName, oldKey);
            jdbcTemplate.update("UPDATE ACT_RE_DEPLOYMENT SET NAME_ = ? WHERE ID_ IN " +
                "(SELECT DEPLOYMENT_ID_ FROM ACT_RE_PROCDEF WHERE KEY_ = ?)", newName, oldKey);
        }

        // Update key in ACT_RE_PROCDEF and BPMN XML in ACT_GE_BYTEARRAY
        if (!newKey.equals(oldKey)) {
            jdbcTemplate.update("UPDATE ACT_RE_PROCDEF SET KEY_ = ? WHERE KEY_ = ?", newKey, oldKey);
            // Update XML process id in byte arrays for all versions
            jdbcTemplate.update(
                "UPDATE ACT_GE_BYTEARRAY SET BYTES_ = REPLACE(BYTES_, " +
                "('<bpmn:process id=\"' || ? || '\"'), ('<bpmn:process id=\"' || ? || '\"')) " +
                "WHERE DEPLOYMENT_ID_ IN (SELECT DEPLOYMENT_ID_ FROM ACT_RE_PROCDEF WHERE KEY_ = ?) " +
                "AND NAME_ LIKE '%.bpmn20.xml'", newKey, oldKey, newKey);
        }

        // Refresh and return the updated definition
        var updatedDef = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(definitionId).singleResult();
        var vo = new ProcessDefinitionVO();
        vo.setId(updatedDef.getId());
        vo.setName(updatedDef.getName());
        vo.setKey(updatedDef.getKey());
        vo.setVersion(updatedDef.getVersion());
        vo.setDescription(updatedDef.getDescription());
        vo.setCategory(updatedDef.getCategory());
        vo.setDeploymentId(updatedDef.getDeploymentId());
        vo.setSuspended(updatedDef.isSuspended());
        vo.setTenantId(updatedDef.getTenantId());
        return vo;
    }

    private InstanceVO toInstanceVO(ProcessInstance pi) {
        var vo = new InstanceVO();
        vo.setId(pi.getId());
        vo.setBusinessKey(pi.getBusinessKey());
        vo.setProcessDefinitionId(pi.getProcessDefinitionId());
        vo.setProcessDefinitionKey(pi.getProcessDefinitionKey());
        vo.setProcessDefinitionName(pi.getProcessDefinitionName());
        vo.setStartTime(dateToLocal(pi.getStartTime()));
        vo.setEnded(pi.isEnded());
        vo.setSuspended(pi.isSuspended());
        return vo;
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
