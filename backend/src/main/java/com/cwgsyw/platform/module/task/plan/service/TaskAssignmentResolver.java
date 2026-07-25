package com.cwgsyw.platform.module.task.plan.service;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.task.plan.dto.AssignmentTarget;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TaskAssignmentResolver {
    public static final int MAX_TARGETS = 2000;
    private final AssignmentDirectory directory;

    public List<AssignmentTarget> resolve(String tenantId, String generationMode,
                                          Map<String, Object> assignmentRule, LocalDateTime occurrenceAt) {
        Map<String, Object> rule = assignmentRule == null ? Map.of() : assignmentRule;
        List<Long> userIds = longList(rule.get("userIds"));
        List<Long> groupIds = longList(rule.get("groupIds"));
        String strategy = text(rule, "strategy", userIds.isEmpty() ? "group_members" : "users");
        List<AssignmentTarget> targets = switch (generationMode == null ? "" : generationMode) {
            case "per_user" -> userTargets(tenantId, strategy, userIds, groupIds, occurrenceAt);
            case "per_group" -> groupTargets(tenantId, groupIds);
            case "shared" -> sharedTarget(tenantId, userIds, groupIds);
            case "single" -> singleTarget(tenantId, strategy, userIds, groupIds, occurrenceAt);
            default -> throw BusinessException.badRequest("INVALID_GENERATION_MODE", "不支持的生成模式: " + generationMode);
        };
        if (targets.isEmpty()) throw BusinessException.badRequest("ASSIGNMENT_TARGET_EMPTY", "分配规则没有命中有效执行对象");
        if (targets.size() > MAX_TARGETS) {
            throw BusinessException.badRequest("ASSIGNMENT_SCOPE_TOO_LARGE", "执行对象超过 " + MAX_TARGETS + " 个，请缩小人员或组范围");
        }
        return targets;
    }

    private List<AssignmentTarget> userTargets(String tenantId, String strategy, List<Long> userIds,
                                               List<Long> groupIds, LocalDateTime occurrenceAt) {
        List<AssignmentDirectory.UserSubject> users = switch (strategy) {
            case "all_users" -> directory.findAllUsers(tenantId);
            case "users" -> directory.findUsers(tenantId, userIds);
            case "group_members" -> directory.findGroupMembers(tenantId, groupIds);
            case "group_leaders" -> directory.findGroupLeaders(tenantId, groupIds);
            case "duty_roster" -> directory.findDutyUsers(tenantId, groupIds, occurrenceAt.toLocalDate());
            default -> throw BusinessException.badRequest("INVALID_ASSIGNMENT_STRATEGY", "不支持的人员分配策略: " + strategy);
        };
        LinkedHashMap<Long, AssignmentTarget> targets = new LinkedHashMap<>();
        for (AssignmentDirectory.UserSubject user : users) {
            targets.putIfAbsent(user.userId(), new AssignmentTarget("user", user.userId(), user.userId(), user.groupId(),
                displayName(user), userSnapshot(user)));
        }
        return List.copyOf(targets.values());
    }

    private List<AssignmentTarget> groupTargets(String tenantId, List<Long> groupIds) {
        return directory.findGroups(tenantId, groupIds).stream().map(group -> new AssignmentTarget(
            "group", group.groupId(), group.leaderId(), group.groupId(), group.groupName(), groupSnapshot(group))).toList();
    }

    private List<AssignmentTarget> sharedTarget(String tenantId, List<Long> userIds, List<Long> groupIds) {
        List<AssignmentDirectory.UserSubject> users = directory.findUsers(tenantId, userIds);
        List<AssignmentDirectory.GroupSubject> groups = directory.findGroups(tenantId, groupIds);
        if (users.isEmpty() && groups.isEmpty()) return List.of();
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("users", users.stream().map(this::userSnapshot).toList());
        snapshot.put("groups", groups.stream().map(this::groupSnapshot).toList());
        Long assigneeId = users.isEmpty() ? groups.getFirst().leaderId() : users.getFirst().userId();
        Long groupId = groups.isEmpty() ? (users.isEmpty() ? null : users.getFirst().groupId()) : groups.getFirst().groupId();
        return List.of(new AssignmentTarget("shared", null, assigneeId, groupId, "共享任务", Map.copyOf(snapshot)));
    }

    private List<AssignmentTarget> singleTarget(String tenantId, String strategy, List<Long> userIds,
                                                List<Long> groupIds, LocalDateTime occurrenceAt) {
        List<AssignmentTarget> users = userTargets(tenantId, strategy, userIds, groupIds, occurrenceAt);
        if (users.isEmpty()) return List.of();
        AssignmentTarget first = users.getFirst();
        return List.of(new AssignmentTarget("shared", first.subjectId(), first.assigneeId(), first.groupId(),
            first.displayName(), first.organizationSnapshot()));
    }

    private String displayName(AssignmentDirectory.UserSubject user) {
        return user.realName() == null || user.realName().isBlank() ? user.username() : user.realName();
    }

    private Map<String, Object> userSnapshot(AssignmentDirectory.UserSubject user) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("userId", user.userId());
        snapshot.put("username", user.username());
        snapshot.put("realName", user.realName());
        snapshot.put("groupId", user.groupId());
        snapshot.put("groupName", user.groupName());
        return snapshot;
    }

    private Map<String, Object> groupSnapshot(AssignmentDirectory.GroupSubject group) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("userId", group.leaderId());
        snapshot.put("realName", group.leaderName());
        snapshot.put("groupId", group.groupId());
        snapshot.put("groupCode", group.groupCode());
        snapshot.put("groupName", group.groupName());
        snapshot.put("leaderId", group.leaderId());
        snapshot.put("leaderName", group.leaderName());
        return snapshot;
    }

    private List<Long> longList(Object value) {
        if (!(value instanceof Collection<?> collection)) return List.of();
        List<Long> values = new ArrayList<>();
        for (Object item : collection) {
            try {
                values.add(item instanceof Number number ? number.longValue() : Long.valueOf(String.valueOf(item)));
            } catch (NumberFormatException exception) {
                throw BusinessException.badRequest("INVALID_ASSIGNMENT_ID", "人员或组 ID 格式无效: " + item);
            }
        }
        return values.stream().distinct().toList();
    }

    private String text(Map<String, Object> values, String key, String fallback) {
        Object value = values.get(key);
        return value == null ? fallback : String.valueOf(value);
    }
}
