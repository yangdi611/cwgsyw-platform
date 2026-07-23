package com.cwgsyw.platform.module.workflow.adapter;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.approval.workflow.ApprovalProcessDeployment;
import com.cwgsyw.platform.module.approval.workflow.ApprovalProcessNode;
import com.cwgsyw.platform.module.approval.workflow.ApprovalWorkflowStart;
import com.cwgsyw.platform.module.approval.workflow.ApprovalWorkflowTask;
import com.cwgsyw.platform.module.approval.workflow.TaskApprovalWorkflowPort;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.UserGroupMembershipMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.rbac.SysRoleMapper;
import com.cwgsyw.platform.module.workflow.event.WorkflowBusinessInstance;
import com.cwgsyw.platform.module.workflow.event.WorkflowBusinessInstanceMapper;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.task.api.Task;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class TaskApprovalWorkflowAdapter implements TaskApprovalWorkflowPort {
    private static final String BUSINESS_TYPE = "task_submission";
    private static final String COMPLETION_LISTENER = "${workflowCompletionListener}";

    private final RepositoryService repositoryService;
    private final RuntimeService runtimeService;
    private final TaskService taskService;
    private final WorkflowBusinessInstanceMapper businessInstanceMapper;
    private final UserGroupMembershipMapper membershipMapper;
    private final GroupMapper groupMapper;
    private final RbacService rbacService;
    private final SysRoleMapper roleMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ApprovalProcessDeployment publish(String tenantId, String processKey, String name,
                                               List<ApprovalProcessNode> nodes) {
        if (repositoryService.createProcessDefinitionQuery().processDefinitionKey(processKey).count() > 0) {
            throw BusinessException.badRequest("APPROVAL_PROCESS_KEY_EXISTS", "审批流程定义编码已存在");
        }
        var deployment = repositoryService.createDeployment()
            .tenantId(tenantId)
            .name(name)
            .category("task_approval")
            .addString(processKey + ".bpmn20.xml", bpmn(processKey, name, nodes))
            .deploy();
        ProcessDefinition definition = repositoryService.createProcessDefinitionQuery()
            .deploymentId(deployment.getId()).singleResult();
        if (definition == null) throw new IllegalStateException("审批流程定义部署后不可见");
        return new ApprovalProcessDeployment(definition.getId(), definition.getKey(), definition.getVersion());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public WorkflowBusinessInstance start(ApprovalWorkflowStart command) {
        ProcessDefinition definition = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(command.processDefinitionId()).singleResult();
        if (definition == null || definition.isSuspended()) {
            throw BusinessException.badRequest("APPROVAL_PROCESS_UNAVAILABLE", "审批流程定义不存在或已挂起");
        }
        if (definition.getTenantId() != null && !definition.getTenantId().isBlank()
                && !command.tenantId().equals(definition.getTenantId())) {
            throw BusinessException.forbidden("APPROVAL_PROCESS_TENANT_MISMATCH", "审批流程定义不属于当前租户");
        }
        String businessId = String.valueOf(command.submissionId());
        String businessKey = BUSINESS_TYPE + ':' + businessId;
        Map<String, Object> variables = new LinkedHashMap<>();
        variables.put("tenantId", command.tenantId());
        variables.put("businessType", BUSINESS_TYPE);
        variables.put("businessId", businessId);
        variables.put("businessKey", businessKey);
        variables.put("submissionId", command.submissionId());
        variables.put("approvalRoundId", command.roundId());
        variables.put("submitterId", command.submitterId());
        variables.put("approved", false);
        ProcessInstance process = runtimeService.startProcessInstanceById(
            command.processDefinitionId(), businessKey, variables);

        WorkflowBusinessInstance instance = new WorkflowBusinessInstance();
        instance.setTenantId(command.tenantId());
        instance.setBusinessType(BUSINESS_TYPE);
        instance.setBusinessId(businessId);
        instance.setBusinessKey(businessKey);
        instance.setProcessInstanceId(process.getId());
        instance.setProcessDefinitionId(definition.getId());
        instance.setProcessDefinitionKey(definition.getKey());
        instance.setProcessDefinitionVersion(definition.getVersion());
        instance.setStatus("running");
        instance.setSubmitterId(command.submitterId());
        instance.setStartedAt(LocalDateTime.now());
        businessInstanceMapper.insert(instance);
        return instance;
    }

    @Override
    public List<ApprovalWorkflowTask> listPending(SecurityUser user) {
        String userId = String.valueOf(user.getUserId());
        List<String> groups = candidateGroups(user);
        var query = taskService.createTaskQuery();
        if (groups.isEmpty()) {
            query.taskCandidateOrAssigned(userId);
        } else {
            query.or().taskCandidateOrAssigned(userId).taskCandidateGroupIn(groups).endOr();
        }
        return query.orderByTaskCreateTime().desc().list().stream()
            .map(task -> toTask(user.getTenantId(), task))
            .filter(java.util.Objects::nonNull)
            .toList();
    }

    @Override
    public ApprovalWorkflowTask requirePending(SecurityUser user, String workflowTaskId) {
        Task task = taskService.createTaskQuery().taskId(workflowTaskId).singleResult();
        if (task == null) throw new BusinessException(404, "APPROVAL_TASK_NOT_FOUND", "审批任务不存在或已完成");
        if (!isCandidate(task, user)) {
            throw BusinessException.forbidden("APPROVAL_NOT_CANDIDATE", "您不是当前节点候选审批人");
        }
        ApprovalWorkflowTask result = toTask(user.getTenantId(), task);
        if (result == null) throw new BusinessException(404, "APPROVAL_TASK_NOT_FOUND", "审批任务不存在或已完成");
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void complete(SecurityUser user, ApprovalWorkflowTask approvalTask, boolean approved,
                         String comment, Map<String, Object> variables) {
        if (!user.getPermissions().contains("workflow:approve")
                || !user.getPermissions().contains("work_item:approve")) {
            throw BusinessException.forbidden("APPROVAL_PERMISSION_DENIED", "缺少审批权限");
        }
        Task task = taskService.createTaskQuery().taskId(approvalTask.id()).singleResult();
        if (task == null) throw new BusinessException(404, "APPROVAL_TASK_NOT_FOUND", "审批任务不存在或已完成");
        String userId = String.valueOf(user.getUserId());
        if (!isCandidate(task, user)) {
            throw BusinessException.forbidden("APPROVAL_NOT_CANDIDATE", "您不是当前节点候选审批人");
        }
        if (task.getAssignee() == null) taskService.claim(task.getId(), userId);
        else if (!userId.equals(task.getAssignee())) {
            throw BusinessException.forbidden("APPROVAL_ALREADY_CLAIMED", "审批任务已被其他人认领");
        }
        Map<String, Object> completion = new LinkedHashMap<>();
        completion.put("approved", approved);
        completion.put("approverId", user.getUserId());
        completion.put("approvedAt", LocalDateTime.now().toString());
        if (comment != null) completion.put("comment", comment);
        if (variables != null) completion.putAll(variables);
        taskService.complete(task.getId(), completion);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void returnToNode(SecurityUser user, ApprovalWorkflowTask approvalTask, String targetNodeKey,
                             String comment, Map<String, Object> variables) {
        if (!user.getPermissions().contains("workflow:approve")
                || !user.getPermissions().contains("work_item:approve")) {
            throw BusinessException.forbidden("APPROVAL_PERMISSION_DENIED", "缺少审批权限");
        }
        Task task = taskService.createTaskQuery().taskId(approvalTask.id()).singleResult();
        if (task == null) throw new BusinessException(404, "APPROVAL_TASK_NOT_FOUND", "审批任务不存在或已完成");
        if (!isCandidate(task, user)) {
            throw BusinessException.forbidden("APPROVAL_NOT_CANDIDATE", "您不是当前节点候选审批人");
        }
        if (variables != null && !variables.isEmpty()) {
            runtimeService.setVariables(task.getProcessInstanceId(), variables);
        }
        if (comment != null) runtimeService.setVariable(task.getProcessInstanceId(), "comment", comment);
        runtimeService.setVariable(task.getProcessInstanceId(), "approverId", user.getUserId());
        runtimeService.createChangeActivityStateBuilder()
            .processInstanceId(task.getProcessInstanceId())
            .moveActivityIdTo(task.getTaskDefinitionKey(), targetNodeKey)
            .changeState();
    }

    private ApprovalWorkflowTask toTask(String tenantId, Task task) {
        WorkflowBusinessInstance mapping = businessInstanceMapper.selectOne(
            new LambdaQueryWrapper<WorkflowBusinessInstance>()
                .eq(WorkflowBusinessInstance::getTenantId, tenantId)
                .eq(WorkflowBusinessInstance::getProcessInstanceId, task.getProcessInstanceId())
                .eq(WorkflowBusinessInstance::getBusinessType, BUSINESS_TYPE)
                .eq(WorkflowBusinessInstance::getStatus, "running")
                .last("LIMIT 1"));
        if (mapping == null) return null;
        Map<String, Object> variables = runtimeService.getVariables(task.getProcessInstanceId());
        Long submissionId = longValue(variables.get("submissionId"));
        Long roundId = longValue(variables.get("approvalRoundId"));
        if (submissionId == null || roundId == null) return null;
        return new ApprovalWorkflowTask(task.getId(), task.getProcessInstanceId(), task.getProcessDefinitionId(),
            task.getTaskDefinitionKey(), task.getName(), submissionId, roundId,
            task.getCreateTime() == null ? null : task.getCreateTime().toInstant()
                .atZone(ZoneId.systemDefault()).toLocalDateTime());
    }

    private boolean isCandidate(Task task, SecurityUser user) {
        String userId = String.valueOf(user.getUserId());
        if (userId.equals(task.getAssignee())) return true;
        List<String> groups = candidateGroups(user);
        var query = taskService.createTaskQuery().taskId(task.getId());
        if (groups.isEmpty()) query.taskCandidateOrAssigned(userId);
        else query.or().taskCandidateOrAssigned(userId).taskCandidateGroupIn(groups).endOr();
        return query.count() > 0;
    }

    private List<String> candidateGroups(SecurityUser user) {
        Set<String> tokens = new LinkedHashSet<>();
        membershipMapper.findEffectiveActiveBusinessGroupIds(user.getTenantId(), user.getUserId())
            .stream().map(id -> "group_" + id).forEach(tokens::add);
        if (user.getGroupId() != null) tokens.add("group_" + user.getGroupId());
        List<Long> roleIds = rbacService.getUserRoleIds(user.getUserId());
        if (roleIds != null && !roleIds.isEmpty()) {
            roleMapper.selectBatchIds(roleIds).stream()
                .filter(role -> user.getTenantId().equals(role.getTenantId()) && !Boolean.TRUE.equals(role.getIsDeleted()))
                .map(role -> "role_" + role.getCode()).forEach(tokens::add);
        }
        return new ArrayList<>(tokens);
    }

    private Long longValue(Object value) {
        if (value instanceof Number number) return number.longValue();
        if (value == null) return null;
        try { return Long.valueOf(String.valueOf(value)); }
        catch (NumberFormatException exception) { return null; }
    }

    private String bpmn(String processKey, String name, List<ApprovalProcessNode> nodes) {
        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
            .append("<definitions xmlns=\"http://www.omg.org/spec/BPMN/20100524/MODEL\"\n")
            .append(" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n")
            .append(" xmlns:flowable=\"http://flowable.org/bpmn\"\n")
            .append(" targetNamespace=\"http://cwgsyw.com/task-approval\">\n")
            .append("  <process id=\"").append(escape(processKey)).append("\" name=\"")
            .append(escape(name)).append("\" isExecutable=\"true\">\n")
            .append("    <startEvent id=\"start\" name=\"提交\"/>\n")
            .append("    <sequenceFlow id=\"flow_start\" sourceRef=\"start\" targetRef=\"")
            .append(escape(nodes.getFirst().key())).append("\"/>\n");
        for (int index = 0; index < nodes.size(); index++) {
            ApprovalProcessNode node = nodes.get(index);
            xml.append("    <userTask id=\"").append(escape(node.key())).append("\" name=\"")
                .append(escape(node.name())).append("\"");
            if (node.assignee() != null) xml.append(" flowable:assignee=\"").append(escape(node.assignee())).append("\"");
            else xml.append(" flowable:candidateGroups=\"").append(escape(node.candidateGroup())).append("\"");
            xml.append("/>\n");
            String gateway = "result_" + index;
            xml.append("    <sequenceFlow id=\"flow_result_").append(index).append("\" sourceRef=\"")
                .append(escape(node.key())).append("\" targetRef=\"").append(gateway).append("\"/>\n")
                .append("    <exclusiveGateway id=\"").append(gateway).append("\"/>\n");
            String approvedTarget = index + 1 < nodes.size() ? nodes.get(index + 1).key() : "approvedEnd";
            conditional(xml, "flow_approved_" + index, gateway, approvedTarget, true);
            conditional(xml, "flow_returned_" + index, gateway, "returnedEnd", false);
        }
        endEvent(xml, "approvedEnd", "审批通过");
        endEvent(xml, "returnedEnd", "退回或终止");
        xml.append("  </process>\n</definitions>\n");
        return xml.toString();
    }

    private void conditional(StringBuilder xml, String id, String source, String target, boolean approved) {
        xml.append("    <sequenceFlow id=\"").append(id).append("\" sourceRef=\"").append(source)
            .append("\" targetRef=\"").append(escape(target)).append("\">\n")
            .append("      <conditionExpression xsi:type=\"tFormalExpression\">${approved == ")
            .append(approved).append("}</conditionExpression>\n")
            .append("    </sequenceFlow>\n");
    }

    private void endEvent(StringBuilder xml, String id, String name) {
        xml.append("    <endEvent id=\"").append(id).append("\" name=\"").append(name).append("\">\n")
            .append("      <extensionElements>\n")
            .append("        <flowable:executionListener event=\"start\" delegateExpression=\"")
            .append(COMPLETION_LISTENER).append("\"/>\n")
            .append("      </extensionElements>\n")
            .append("    </endEvent>\n");
    }

    private String escape(String value) {
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace("\"", "&quot;");
    }
}
