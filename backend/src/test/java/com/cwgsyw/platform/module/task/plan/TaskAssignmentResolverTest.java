package com.cwgsyw.platform.module.task.plan;

import com.cwgsyw.platform.module.task.plan.service.AssignmentDirectory;
import com.cwgsyw.platform.module.task.plan.service.TaskAssignmentResolver;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TaskAssignmentResolverTest {
    private final AssignmentDirectory directory = new AssignmentDirectory() {
        @Override
        public List<UserSubject> findAllUsers(String tenantId) {
            return List.of(new UserSubject(1L, "u1", "用户1", 10L, "数据库组"),
                new UserSubject(2L, "u2", "用户2", 20L, "网络组"));
        }

        @Override
        public List<UserSubject> findUsers(String tenantId, List<Long> userIds) {
            return userIds.stream().map(id -> new UserSubject(id, "u" + id, "用户" + id, 10L, "数据库组")).toList();
        }

        @Override
        public List<GroupSubject> findGroups(String tenantId, List<Long> groupIds) {
            return groupIds.stream().map(id -> new GroupSubject(id, "g" + id, "组" + id, id + 100, "负责人" + id)).toList();
        }

        @Override
        public List<UserSubject> findGroupMembers(String tenantId, List<Long> groupIds) {
            return List.of(new UserSubject(1L, "u1", "用户1", 10L, "数据库组"),
                new UserSubject(2L, "u2", "用户2", 10L, "数据库组"));
        }

        @Override
        public List<UserSubject> findGroupLeaders(String tenantId, List<Long> groupIds) {
            return List.of(new UserSubject(100L, "leader", "负责人", 10L, "数据库组"));
        }

        @Override
        public List<UserSubject> findDutyUsers(String tenantId, List<Long> groupIds, LocalDate dutyDate) {
            return List.of(new UserSubject(200L, "duty", "值班人", 10L, "数据库组"));
        }
    };
    private final TaskAssignmentResolver resolver = new TaskAssignmentResolver(directory);

    @Test
    void resolvesAllGenerationModes() {
        LocalDateTime occurrence = LocalDateTime.of(2026, 7, 23, 9, 0);
        assertThat(resolver.resolve("default", "per_user", Map.of("strategy", "group_members", "groupIds", List.of(10)), occurrence)).hasSize(2);
        assertThat(resolver.resolve("default", "per_user", Map.of("strategy", "all_users"), occurrence))
            .extracting(target -> target.assigneeId()).containsExactly(1L, 2L);
        assertThat(resolver.resolve("default", "per_group", Map.of("groupIds", List.of(10, 20)), occurrence)).hasSize(2);
        assertThat(resolver.resolve("default", "shared", Map.of("userIds", List.of(1, 2), "groupIds", List.of(10)), occurrence))
            .singleElement().satisfies(target -> assertThat(target.organizationSnapshot()).containsKeys("users", "groups"));
        assertThat(resolver.resolve("default", "single", Map.of("strategy", "duty_roster", "groupIds", List.of(10)), occurrence))
            .singleElement().satisfies(target -> assertThat(target.assigneeId()).isEqualTo(200L));
    }
}
