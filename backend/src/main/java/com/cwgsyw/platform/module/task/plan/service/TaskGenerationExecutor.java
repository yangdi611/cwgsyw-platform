package com.cwgsyw.platform.module.task.plan.service;

import com.cwgsyw.platform.module.task.plan.dto.AssignmentTarget;
import com.cwgsyw.platform.module.task.plan.dto.CiScopeResolution;
import com.cwgsyw.platform.module.task.plan.entity.TaskPlan;
import com.cwgsyw.platform.module.task.plan.entity.TaskPlanGeneration;
import com.cwgsyw.platform.module.task.plan.mapper.TaskPlanGenerationMapper;
import com.cwgsyw.platform.module.task.notification.TaskNotificationOutbox;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.entity.TaskParticipant;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskInstanceMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskParticipantMapper;
import com.cwgsyw.platform.module.task.template.entity.TaskTemplateVersion;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TaskGenerationExecutor {
    private final TaskInstanceMapper taskMapper;
    private final TaskParticipantMapper participantMapper;
    private final TaskPlanGenerationMapper generationMapper;
    private final TaskNotificationOutbox notificationOutbox;

    @Transactional(rollbackFor = Exception.class)
    public Long createTask(TaskPlan plan, TaskTemplateVersion template, TaskPlanGeneration generation,
                           AssignmentTarget target, CiScopeResolution ciScope, LocalDateTime dueAt) {
        TaskInstance task = new TaskInstance();
        task.setTenantId(plan.getTenantId());
        task.setPlanId(plan.getId());
        task.setGenerationId(generation.getId());
        task.setTemplateVersionId(plan.getTemplateVersionId());
        task.setApprovalSchemeVersionId(plan.getApprovalSchemeVersionId());
        task.setTitle(template.getNameSnapshot());
        task.setDescription(template.getDescriptionSnapshot());
        task.setBusinessDate(generation.getOccurrenceAt().toLocalDate());
        task.setPlannedStartAt(generation.getOccurrenceAt());
        task.setDueAt(dueAt);
        task.setPriority(priority(plan.getScheduleConfig()));
        task.setExecutionStatus("not_started");
        task.setApprovalStatus(plan.getApprovalSchemeVersionId() == null ? "not_required" : "not_started");
        task.setAssigneeId(target.assigneeId());
        task.setGroupId(target.groupId());
        task.setOrganizationSnapshot(target.organizationSnapshot());
        task.setCiScopeSnapshot(ciSnapshot(ciScope));
        task.setOverdue(false);
        task.setLockVersion(0);
        task.setCreatedBy(plan.getCreatedBy());
        task.setUpdatedBy(plan.getUpdatedBy());
        task.setIsDeleted(false);
        taskMapper.insert(task);

        if (target.assigneeId() != null) insertParticipant(plan.getTenantId(), task.getId(), target.assigneeId(), "assignee");
        sharedUserIds(target.organizationSnapshot()).stream()
            .filter(userId -> !userId.equals(target.assigneeId()))
            .forEach(userId -> insertParticipant(plan.getTenantId(), task.getId(), userId, "collaborator"));

        if (target.assigneeId() != null) {
            notificationOutbox.enqueue(plan.getTenantId(), task.getId(), null, null, "task_created",
                target.assigneeId(), "notification", "task:" + task.getId() + ":created:" + target.assigneeId(),
                Map.of("title", task.getTitle(), "dueAt", String.valueOf(task.getDueAt()), "refType", "task", "refId", task.getId()),
                LocalDateTime.now());
        }

        generation.setTaskId(task.getId());
        generation.setStatus("succeeded");
        generation.setErrorCode(null);
        generation.setErrorMessage(null);
        generationMapper.updateById(generation);
        return task.getId();
    }

    private void insertParticipant(String tenantId, Long taskId, Long userId, String role) {
        TaskParticipant participant = new TaskParticipant();
        participant.setTenantId(tenantId);
        participant.setTaskId(taskId);
        participant.setUserId(userId);
        participant.setRole(role);
        participantMapper.insert(participant);
    }

    private Map<String, Object> ciSnapshot(CiScopeResolution resolution) {
        if (resolution == null) return Map.of("selections", List.of(), "total", 0, "instances", List.of());
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("selections", resolution.selections());
        snapshot.put("total", resolution.total());
        snapshot.put("instances", resolution.instances());
        snapshot.put("resolvedAt", LocalDateTime.now().toString());
        snapshot.put("warnings", resolution.warnings());
        return snapshot;
    }

    private String priority(Map<String, Object> scheduleConfig) {
        Object value = scheduleConfig == null ? null : scheduleConfig.get("priority");
        String priority = value == null ? "normal" : String.valueOf(value);
        return List.of("low", "normal", "high", "critical").contains(priority) ? priority : "normal";
    }

    private List<Long> sharedUserIds(Map<String, Object> snapshot) {
        Object raw = snapshot == null ? null : snapshot.get("users");
        if (!(raw instanceof List<?> values)) return List.of();
        return values.stream().filter(Map.class::isInstance).map(Map.class::cast)
            .map(value -> value.get("userId"))
            .filter(java.util.Objects::nonNull)
            .map(value -> value instanceof Number number ? number.longValue() : Long.valueOf(String.valueOf(value)))
            .distinct().toList();
    }
}
