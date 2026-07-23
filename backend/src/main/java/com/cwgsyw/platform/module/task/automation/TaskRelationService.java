package com.cwgsyw.platform.module.task.automation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.task.automation.dto.TaskRelationVO;
import com.cwgsyw.platform.module.task.automation.entity.TaskRelation;
import com.cwgsyw.platform.module.task.automation.mapper.TaskRelationMapper;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskInstanceMapper;
import com.cwgsyw.platform.module.task.runtime.service.TaskVisibilityService;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TaskRelationService {
    private static final Set<String> TYPES = Set.of("remediation", "recheck", "derived", "blocks", "related");
    private static final Set<String> DIRECTED = Set.of("remediation", "recheck", "derived", "blocks");

    private final TaskRelationMapper relationMapper;
    private final TaskInstanceMapper taskMapper;
    private final TaskVisibilityService visibilityService;

    public List<TaskRelationVO> list(SecurityUser user, Long taskId) {
        TaskInstance task = requireTask(user.getTenantId(), taskId);
        visibilityService.requireView(task, user);
        return relationMapper.selectList(new LambdaQueryWrapper<TaskRelation>()
            .eq(TaskRelation::getTenantId, user.getTenantId())
            .and(value -> value.eq(TaskRelation::getSourceTaskId, taskId).or().eq(TaskRelation::getTargetTaskId, taskId))
            .orderByAsc(TaskRelation::getCreatedAt).orderByAsc(TaskRelation::getId)).stream()
            .filter(relation -> canViewBothTasks(user, relation))
            .map(this::toVO).toList();
    }

    @Transactional(rollbackFor = Exception.class)
    public TaskRelationVO create(String tenantId, Long sourceTaskId, Long targetTaskId, String type,
                                 Long executionId) {
        if (!TYPES.contains(type)) throw BusinessException.badRequest("TASK_RELATION_TYPE_INVALID", "任务关系类型无效");
        requireTask(tenantId, sourceTaskId);
        requireTask(tenantId, targetTaskId);
        if (sourceTaskId.equals(targetTaskId) || DIRECTED.contains(type) && reaches(tenantId, targetTaskId, sourceTaskId)) {
            throw BusinessException.badRequest("TASK_RELATION_CYCLE", "任务关系不能形成有向环");
        }
        TaskRelation relation = new TaskRelation();
        relation.setTenantId(tenantId); relation.setSourceTaskId(sourceTaskId); relation.setTargetTaskId(targetTaskId);
        relation.setRelationType(type); relation.setAutomationExecutionId(executionId);
        relation.setCreatedAt(LocalDateTime.now());
        relationMapper.insert(relation);
        return toVO(relation);
    }

    private boolean reaches(String tenantId, Long from, Long target) {
        List<TaskRelation> relations = relationMapper.selectList(new LambdaQueryWrapper<TaskRelation>()
            .eq(TaskRelation::getTenantId, tenantId).in(TaskRelation::getRelationType, DIRECTED));
        ArrayDeque<Long> pending = new ArrayDeque<>();
        Set<Long> seen = new HashSet<>();
        pending.add(from);
        while (!pending.isEmpty()) {
            Long current = pending.removeFirst();
            if (!seen.add(current)) continue;
            if (current.equals(target)) return true;
            relations.stream().filter(value -> current.equals(value.getSourceTaskId()))
                .map(TaskRelation::getTargetTaskId).forEach(pending::addLast);
        }
        return false;
    }

    private TaskInstance requireTask(String tenantId, Long taskId) {
        TaskInstance task = taskMapper.selectOne(new LambdaQueryWrapper<TaskInstance>()
            .eq(TaskInstance::getTenantId, tenantId).eq(TaskInstance::getId, taskId)
            .eq(TaskInstance::getIsDeleted, false));
        if (task == null) throw new BusinessException(404, "TASK_NOT_FOUND", "任务不存在");
        return task;
    }

    private boolean canViewBothTasks(SecurityUser user, TaskRelation relation) {
        TaskInstance source = requireTask(user.getTenantId(), relation.getSourceTaskId());
        TaskInstance target = requireTask(user.getTenantId(), relation.getTargetTaskId());
        return visibilityService.canView(source, user) && visibilityService.canView(target, user);
    }

    private TaskRelationVO toVO(TaskRelation value) {
        return new TaskRelationVO(value.getId(), value.getSourceTaskId(), value.getTargetTaskId(), value.getRelationType(),
            value.getAutomationExecutionId(), value.getCreatedAt());
    }
}
