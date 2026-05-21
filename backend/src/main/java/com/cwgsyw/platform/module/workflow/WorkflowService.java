package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.module.workflow.dto.TaskVO;
import lombok.RequiredArgsConstructor;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.task.api.Task;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkflowService {
    private final RuntimeService runtimeService;
    private final TaskService taskService;

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

        taskService.claim(taskId, String.valueOf(approverId));

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
        return tasks.stream().map(this::toVO).collect(Collectors.toList());
    }

    public List<TaskVO> getPendingTasksByUser(Long userId) {
        List<Task> tasks = taskService.createTaskQuery()
            .taskCandidateOrAssigned(String.valueOf(userId))
            .orderByTaskCreateTime().desc()
            .list();
        return tasks.stream().map(this::toVO).collect(Collectors.toList());
    }

    private TaskVO toVO(Task task) {
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

        ProcessInstance pi = runtimeService
            .createProcessInstanceQuery()
            .processInstanceId(task.getProcessInstanceId())
            .singleResult();
        if (pi != null) {
            String businessKey = pi.getBusinessKey();
            vo.setBusinessKey(businessKey);
            if (businessKey != null && businessKey.startsWith("dailyReport:")) {
                vo.setBusinessType("daily_report");
                vo.setBusinessId(Long.parseLong(businessKey.split(":")[1]));
            }
        }
        return vo;
    }
}
