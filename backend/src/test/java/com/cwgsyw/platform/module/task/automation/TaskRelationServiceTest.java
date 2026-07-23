package com.cwgsyw.platform.module.task.automation;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.task.automation.entity.TaskRelation;
import com.cwgsyw.platform.module.task.automation.mapper.TaskRelationMapper;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskInstanceMapper;
import com.cwgsyw.platform.module.task.runtime.service.TaskVisibilityService;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TaskRelationServiceTest {
    @Test
    void hidesRelationWhenTheOtherTaskIsNotVisible() {
        TaskRelationMapper relationMapper = mock(TaskRelationMapper.class);
        TaskInstanceMapper taskMapper = mock(TaskInstanceMapper.class);
        TaskVisibilityService visibility = mock(TaskVisibilityService.class);
        TaskRelationService service = new TaskRelationService(relationMapper, taskMapper, visibility);
        SecurityUser user = user();
        TaskInstance source = task(1L);
        TaskInstance target = task(2L);
        when(taskMapper.selectOne(any())).thenReturn(source, source, target);
        when(relationMapper.selectList(any())).thenReturn(List.of(relation(1L, 2L, "related")));
        when(visibility.canView(source, user)).thenReturn(true);
        when(visibility.canView(target, user)).thenReturn(false);

        assertThat(service.list(user, 1L)).isEmpty();
    }

    @Test
    void rejectsDirectedCycleAcrossExistingRelations() {
        TaskRelationMapper relationMapper = mock(TaskRelationMapper.class);
        TaskInstanceMapper taskMapper = mock(TaskInstanceMapper.class);
        TaskVisibilityService visibility = mock(TaskVisibilityService.class);
        TaskRelationService service = new TaskRelationService(relationMapper, taskMapper, visibility);
        when(taskMapper.selectOne(any())).thenReturn(task(1L), task(2L));
        when(relationMapper.selectList(any())).thenReturn(List.of(relation(2L, 1L, "derived")));

        assertThatThrownBy(() -> service.create("tenant-a", 1L, 2L, "remediation", 8L))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode()).isEqualTo("TASK_RELATION_CYCLE"));
    }

    private SecurityUser user() {
        return new SecurityUser(3L, "viewer", "", "tenant-a", null, "group", Set.of("task:read"));
    }

    private TaskInstance task(Long id) {
        TaskInstance task = new TaskInstance();
        task.setId(id);
        task.setTenantId("tenant-a");
        task.setIsDeleted(false);
        return task;
    }

    private TaskRelation relation(Long sourceId, Long targetId, String type) {
        TaskRelation relation = new TaskRelation();
        relation.setId(9L);
        relation.setTenantId("tenant-a");
        relation.setSourceTaskId(sourceId);
        relation.setTargetTaskId(targetId);
        relation.setRelationType(type);
        relation.setCreatedAt(LocalDateTime.now());
        return relation;
    }
}
