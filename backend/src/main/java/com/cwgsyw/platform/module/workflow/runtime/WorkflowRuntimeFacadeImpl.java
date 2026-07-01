package com.cwgsyw.platform.module.workflow.runtime;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.workflow.adapter.BusinessWorkflowAdapter;
import com.cwgsyw.platform.module.workflow.adapter.BusinessWorkflowAdapterRegistry;
import com.cwgsyw.platform.module.workflow.adapter.BusinessWorkflowContext;
import com.cwgsyw.platform.module.workflow.adapter.BusinessWorkflowSummary;
import com.cwgsyw.platform.module.workflow.binding.ProcessBindingService;
import com.cwgsyw.platform.module.workflow.binding.WorkflowProcessBinding;
import com.cwgsyw.platform.module.workflow.event.WorkflowBusinessInstance;
import com.cwgsyw.platform.module.workflow.event.WorkflowBusinessInstanceMapper;
import com.cwgsyw.platform.module.workflow.template.TemplateApproverResolver;
import com.cwgsyw.platform.module.workflow.util.BusinessKeyParser;
import com.cwgsyw.platform.module.workflow.util.ParsedBusinessKey;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.HistoryService;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.task.api.Task;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * {@link WorkflowRuntimeFacade} 实现。统一封装 Flowable 交互。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WorkflowRuntimeFacadeImpl implements WorkflowRuntimeFacade {

    private final RuntimeService runtimeService;
    private final TaskService taskService;
    private final RepositoryService repositoryService;
    private final HistoryService historyService;
    private final ProcessBindingService bindingService;
    private final BusinessWorkflowAdapterRegistry adapterRegistry;
    private final WorkflowBusinessInstanceMapper businessInstanceMapper;
    private final com.cwgsyw.platform.module.user.UserMapper userMapper;
    private final TemplateApproverResolver approverResolver;
    private final com.cwgsyw.platform.module.rbac.RbacService rbacService;
    private final com.cwgsyw.platform.module.rbac.SysRoleMapper roleMapper;

    @Override
    @Transactional
    public WorkflowBusinessInstance startBusinessProcess(WorkflowStartCommand command) {
        String tenantId = command.getTenantId();
        String businessType = command.getBusinessType();
        String businessId = command.getBusinessId();

        BusinessWorkflowAdapter adapter = adapterRegistry.require(businessType);

        WorkflowProcessBinding binding = bindingService.getActiveBinding(tenantId, businessType);
        if (binding == null) {
            throw new IllegalStateException("业务类型未绑定流程定义: " + businessType);
        }
        String processDefinitionId = binding.getProcessDefinitionId();
        // 校验流程定义存在且未挂起
        bindingService.validateBindable(tenantId, businessType, processDefinitionId);

        String businessKey = adapter.buildBusinessKey(businessId);

        // 组装启动变量：公共变量 + adapter 业务变量 + 调用方额外变量
        Map<String, Object> vars = new HashMap<>();
        vars.put("businessType", businessType);
        vars.put("businessId", businessId);
        vars.put("businessKey", businessKey);
        vars.put("tenantId", tenantId);
        vars.put("submitterId", command.getSubmitterId());
        vars.put("approved", false);

        // 注入提交人组 token，供模板生成的 ${submitterGroupToken} candidateGroups 消费。
        // 提交人无组时不注入（任务无候选组，仅靠权限门控 + 认领）。
        if (command.getSubmitterId() != null) {
            com.cwgsyw.platform.module.user.entity.User submitter =
                userMapper.selectById(command.getSubmitterId());
            if (submitter != null && submitter.getGroupId() != null) {
                vars.putAll(approverResolver.startVariables(submitter.getGroupId()));
            }
        }

        BusinessWorkflowContext ctx = BusinessWorkflowContext.builder()
            .tenantId(tenantId)
            .businessType(businessType)
            .businessId(businessId)
            .submitterId(command.getSubmitterId())
            .extraVariables(command.getVariables())
            .build();
        Map<String, Object> adapterVars = adapter.buildStartVariables(ctx);
        if (adapterVars != null) {
            vars.putAll(adapterVars);
        }
        if (command.getVariables() != null) {
            vars.putAll(command.getVariables());
        }

        ProcessInstance pi;
        try {
            pi = runtimeService.startProcessInstanceById(processDefinitionId, businessKey, vars);
        } catch (Exception e) {
            // Flowable 启动失败：不得修改业务状态（由调用方在同一事务内回滚）
            log.error("启动流程失败 businessType={} businessId={} defId={}: {}",
                businessType, businessId, processDefinitionId, e.getMessage(), e);
            throw new IllegalStateException("启动审批流程失败: " + e.getMessage(), e);
        }

        WorkflowBusinessInstance instance = new WorkflowBusinessInstance();
        instance.setTenantId(tenantId);
        instance.setBusinessType(businessType);
        instance.setBusinessId(businessId);
        instance.setBusinessKey(businessKey);
        instance.setProcessInstanceId(pi.getId());
        instance.setProcessDefinitionId(binding.getProcessDefinitionId());
        instance.setProcessDefinitionKey(binding.getProcessDefinitionKey());
        instance.setProcessDefinitionVersion(binding.getProcessDefinitionVersion());
        instance.setStatus("running");
        instance.setSubmitterId(command.getSubmitterId());
        instance.setStartedAt(LocalDateTime.now());
        businessInstanceMapper.insert(instance);

        return instance;
    }

    @Override
    @Transactional
    public void completeTask(WorkflowTaskCompleteCommand command) {
        Task task = taskService.createTaskQuery().taskId(command.getTaskId()).singleResult();
        if (task == null) {
            throw new IllegalArgumentException("任务不存在: " + command.getTaskId());
        }

        // 流程实例未挂起
        ProcessInstance pi = runtimeService.createProcessInstanceQuery()
            .processInstanceId(task.getProcessInstanceId())
            .singleResult();
        if (pi != null && pi.isSuspended()) {
            throw new IllegalStateException("流程实例已挂起，无法审批");
        }

        // 解析 businessKey 与 adapter
        String businessKey = pi != null ? pi.getBusinessKey() : null;
        ParsedBusinessKey parsed = BusinessKeyParser.parse(businessKey);
        BusinessWorkflowAdapter adapter = parsed.isRecognized()
            ? adapterRegistry.find(parsed.getBusinessType()).orElse(null) : null;

        // 候选关系校验：assignee 或候选人
        SecurityUser operator = currentUserOrNull();
        String operatorStr = String.valueOf(command.getOperatorId());
        boolean isCandidate = isAssigneeOrCandidate(task, command.getOperatorId(), operator);
        if (!isCandidate) {
            throw new IllegalArgumentException("您不是该任务的候选处理人，无法审批");
        }

        // 业务权限校验（AND 关系）
        if (adapter != null && operator != null) {
            if (!adapter.canApprove(command.getTenantId(), parsed.getBusinessId(), operator)) {
                throw new IllegalArgumentException("您没有该业务的审批权限");
            }
        }

        // claim 后完成
        if (task.getAssignee() == null) {
            taskService.claim(task.getId(), operatorStr);
        } else if (!task.getAssignee().equals(operatorStr)) {
            throw new IllegalArgumentException("该任务已被他人认领");
        }

        Map<String, Object> vars = new HashMap<>();
        vars.put("approved", command.isApproved());
        if (command.getComment() != null) vars.put("comment", command.getComment());
        vars.put("approverId", command.getOperatorId());
        vars.put("approvedAt", LocalDateTime.now().toString());
        if (command.getVariables() != null) vars.putAll(command.getVariables());

        taskService.complete(task.getId(), vars);
    }

    @Override
    public List<WorkflowTaskSummary> listMyTasks(SecurityUser user) {
        // 候选身份：assignee(userId) OR 候选组(提交人组 group_{id} + 角色组 role_{code})
        String userStr = String.valueOf(user.getUserId());
        List<String> groupTokens = candidateGroupTokens(user);
        var query = taskService.createTaskQuery();
        if (groupTokens.isEmpty()) {
            query.taskCandidateOrAssigned(userStr);
        } else {
            // 该 Flowable 版本无 taskCandidateOrAssigned(String, List) 重载，用 or() 组合
            query.or()
                .taskCandidateOrAssigned(userStr)
                .taskCandidateGroupIn(groupTokens)
                .endOr();
        }
        List<Task> tasks = query.orderByTaskCreateTime().desc().list();
        return toSummaries(tasks, user);
    }

    @Override
    public List<WorkflowTaskSummary> listGroupTasks(SecurityUser user) {
        List<String> groupTokens = candidateGroupTokens(user);
        if (groupTokens.isEmpty()) return List.of();
        List<Task> tasks = taskService.createTaskQuery()
            .taskCandidateGroupIn(groupTokens)
            .orderByTaskCreateTime().desc()
            .list();
        return toSummaries(tasks, user);
    }

    /** 当前用户的候选组 token 集合：提交人组 group_{id} + 所有角色组 role_{code}。 */
    private List<String> candidateGroupTokens(SecurityUser user) {
        List<String> tokens = new ArrayList<>();
        if (user.getGroupId() != null) {
            tokens.add(approverResolver.groupToken(user.getGroupId()));
        }
        try {
            List<Long> roleIds = rbacService.getUserRoleIds(user.getUserId());
            if (roleIds != null && !roleIds.isEmpty()) {
                roleMapper.selectBatchIds(roleIds).stream()
                    .map(com.cwgsyw.platform.module.rbac.entity.SysRole::getCode)
                    .filter(c -> c != null && !c.isBlank())
                    .map(c -> TemplateApproverResolver.ROLE_PREFIX + c)
                    .forEach(tokens::add);
            }
        } catch (Exception e) {
            log.warn("解析用户角色候选组失败 userId={}: {}", user.getUserId(), e.getMessage());
        }
        return tokens;
    }

    @Override
    @Transactional
    public void cancelBusinessProcess(String tenantId, String businessType, String businessId,
                                      Long operatorId, String reason) {
        String businessKey = businessType + ":" + businessId;
        WorkflowBusinessInstance instance = businessInstanceMapper.selectOne(
            new LambdaQueryWrapper<WorkflowBusinessInstance>()
                .eq(WorkflowBusinessInstance::getTenantId, tenantId)
                .eq(WorkflowBusinessInstance::getBusinessKey, businessKey)
                .eq(WorkflowBusinessInstance::getStatus, "running")
                .orderByDesc(WorkflowBusinessInstance::getStartedAt)
                .last("LIMIT 1"));
        if (instance == null) return;

        ProcessInstance pi = runtimeService.createProcessInstanceQuery()
            .processInstanceId(instance.getProcessInstanceId())
            .singleResult();
        if (pi != null) {
            runtimeService.deleteProcessInstance(instance.getProcessInstanceId(), reason);
        }
        instance.setStatus("cancelled");
        instance.setResult("cancelled");
        instance.setEndedAt(LocalDateTime.now());
        businessInstanceMapper.updateById(instance);
    }

    // ── 辅助方法 ──────────────────────────────────────────────────────────

    private List<WorkflowTaskSummary> toSummaries(List<Task> tasks, SecurityUser viewer) {
        if (tasks.isEmpty()) return List.of();
        Set<String> piIds = tasks.stream().map(Task::getProcessInstanceId).collect(Collectors.toSet());
        Map<String, String> businessKeyMap = runtimeService.createProcessInstanceQuery()
            .processInstanceIds(piIds)
            .list().stream()
            .collect(Collectors.toMap(ProcessInstance::getId,
                pi -> pi.getBusinessKey() != null ? pi.getBusinessKey() : ""));

        List<WorkflowTaskSummary> result = new ArrayList<>();
        for (Task task : tasks) {
            String businessKey = businessKeyMap.getOrDefault(task.getProcessInstanceId(), "");
            ParsedBusinessKey parsed = BusinessKeyParser.parse(businessKey);
            WorkflowTaskSummary.WorkflowTaskSummaryBuilder b = WorkflowTaskSummary.builder()
                .taskId(task.getId())
                .processInstanceId(task.getProcessInstanceId())
                .taskName(task.getName())
                .assignee(task.getAssignee())
                .createTime(task.getCreateTime() != null
                    ? task.getCreateTime().toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime()
                    : null)
                .businessKey(businessKey)
                .recognized(parsed.isRecognized());

            if (parsed.isRecognized()) {
                b.businessType(parsed.getBusinessType()).businessId(parsed.getBusinessId());
                BusinessWorkflowAdapter adapter = adapterRegistry.find(parsed.getBusinessType()).orElse(null);
                if (adapter != null) {
                    try {
                        BusinessWorkflowSummary summary = adapter.buildSummary(
                            viewer.getTenantId(), parsed.getBusinessId(), viewer);
                        if (summary != null && summary.isAvailable()) {
                            b.businessTitle(summary.getBusinessTitle())
                                .businessSummary(summary.getBusinessSummary())
                                .businessUrl(summary.getBusinessUrl())
                                .submitterName(summary.getSubmitterName());
                        }
                        b.canApprove(isAssigneeOrCandidate(task, viewer.getUserId(), viewer)
                            && adapter.canApprove(viewer.getTenantId(), parsed.getBusinessId(), viewer));
                    } catch (Exception e) {
                        // 单条业务摘要失败不能拖垮整个待办列表
                        log.warn("构造业务摘要失败 businessKey={}: {}", businessKey, e.getMessage());
                    }
                }
            }
            result.add(b.build());
        }
        return result;
    }

    private boolean isAssigneeOrCandidate(Task task, Long userId, SecurityUser user) {
        String userStr = String.valueOf(userId);
        if (userStr.equals(task.getAssignee())) return true;
        // 候选身份：assignee/candidateUser(userId) OR 候选组(提交人组 group_{id} + 角色组 role_{code})
        List<String> groupTokens = user != null ? candidateGroupTokens(user) : List.of();
        var query = taskService.createTaskQuery().taskId(task.getId());
        if (groupTokens.isEmpty()) {
            query.taskCandidateOrAssigned(userStr);
        } else {
            // 该 Flowable 版本无 taskCandidateOrAssigned(String, List) 重载，用 or() 组合
            query.or()
                .taskCandidateOrAssigned(userStr)
                .taskCandidateGroupIn(groupTokens)
                .endOr();
        }
        return query.count() > 0;
    }

    private SecurityUser currentUserOrNull() {
        try {
            Object principal = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
            return principal instanceof SecurityUser su ? su : null;
        } catch (Exception e) {
            return null;
        }
    }
}
