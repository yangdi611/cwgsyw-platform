package com.cwgsyw.platform.module.org;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.authorization.AuthorizationModeService;
import com.cwgsyw.platform.module.org.dto.GroupLifecycleActionRequest;
import com.cwgsyw.platform.module.org.dto.GroupLifecycleBlocker;
import com.cwgsyw.platform.module.org.dto.GroupLifecycleGroupVO;
import com.cwgsyw.platform.module.org.dto.GroupLifecycleListVO;
import com.cwgsyw.platform.module.org.dto.GroupLifecyclePreflightVO;
import com.cwgsyw.platform.module.org.dto.GroupLifecycleResult;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.rbac.RoleAssignmentService;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class GroupLifecycleService {
    private static final List<String> ACTIONS = List.of("archive", "restore", "purge");

    private final GroupMapper groupMapper;
    private final GroupReferenceInventoryService inventoryService;
    private final AuditLogMapper auditLogMapper;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final AuthorizationModeService authorizationModeService;
    private final RoleAssignmentService roleAssignmentService;

    @Value("${group.lifecycle.purge-retention-days:30}")
    private int purgeRetentionDays;

    public List<GroupLifecycleListVO> list(String state, SecurityUser user) {
        if (!List.of("active", "archived").contains(state)) {
            throw error(400, "GROUP_LIFECYCLE_ACTION_INVALID", "state 必须是 active 或 archived");
        }
        if ("archived".equals(state)) requirePermissionAndScope("read", user);
        List<Group> groups = "archived".equals(state)
            ? groupMapper.listArchived(user.getTenantId())
            : groupMapper.selectList(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Group>()
                .eq(Group::getTenantId, user.getTenantId())
                .orderByAsc(Group::getId));
        return groups.stream().map(this::toListVO).toList();
    }

    public GroupLifecyclePreflightVO preflight(Long groupId, String action, SecurityUser user) {
        validateAction(action);
        requirePermissionAndScope(action, user);
        Group group = requireIncludingDeleted(user.getTenantId(), groupId);
        return buildPreflight(group, action);
    }

    @Transactional
    public GroupLifecycleResult archive(Long groupId, GroupLifecycleActionRequest request, SecurityUser user) {
        requirePermissionAndScope("archive", user);
        validateRequest(request);
        Group group = lock(user.getTenantId(), groupId);
        GroupLifecyclePreflightVO preflight = buildPreflight(group, "archive");
        if (!preflight.eligible()) {
            throw blocked(preflight, "GROUP_ARCHIVE_BLOCKED_REFERENCES", "用户组不能归档");
        }
        if (Boolean.TRUE.equals(group.getIsDeleted())) {
            return new GroupLifecycleResult(groupId, "archived", false, null, false);
        }
        validateConfirmation(group, request);
        validateVersion(group, request.getExpectedUpdatedAt());

        String before = lifecycleJson(group, preflight, request.getReason(), "active", null);
        int updated = groupMapper.archiveActive(user.getTenantId(), groupId,
            user.getUserId(), request.getExpectedUpdatedAt());
        if (updated != 1) throw error(409, "GROUP_VERSION_CONFLICT", "用户组状态或版本已变化");
        Group archived = requireIncludingDeleted(user.getTenantId(), groupId);
        String after = lifecycleJson(archived, preflight, request.getReason(), "archived",
            Map.of("relationsChanged", false));
        Long auditId = audit(user, groupId, "group_archive", before, after, request.getReason());
        return new GroupLifecycleResult(groupId, "archived", true, auditId, false);
    }

    @Transactional
    public GroupLifecycleResult restore(Long groupId, GroupLifecycleActionRequest request, SecurityUser user) {
        requirePermissionAndScope("restore", user);
        validateRequest(request);
        Group group = lock(user.getTenantId(), groupId);
        GroupLifecyclePreflightVO preflight = buildPreflight(group, "restore");
        if (!preflight.eligible()) {
            throw blocked(preflight, "GROUP_RESTORE_CODE_CONFLICT", "用户组不能恢复");
        }
        validateConfirmation(group, request);
        validateVersion(group, request.getExpectedUpdatedAt());
        String before = lifecycleJson(group, preflight, request.getReason(), "archived", null);
        int updated = groupMapper.restoreArchived(user.getTenantId(), groupId,
            user.getUserId(), request.getExpectedUpdatedAt());
        if (updated != 1) throw error(409, "GROUP_VERSION_CONFLICT", "用户组状态或版本已变化");
        Group restored = requireIncludingDeleted(user.getTenantId(), groupId);
        String after = lifecycleJson(restored, preflight, request.getReason(), "active",
            Map.of("restoredRelations", false));
        Long auditId = audit(user, groupId, "group_restore", before, after, request.getReason());
        return new GroupLifecycleResult(groupId, "active", true, auditId, false);
    }

    @Transactional
    public GroupLifecycleResult purge(Long groupId, GroupLifecycleActionRequest request, SecurityUser user) {
        requirePermissionAndScope("purge", user);
        validateRequest(request);
        Group group = lock(user.getTenantId(), groupId);
        GroupLifecyclePreflightVO preflight = buildPreflight(group, "purge");
        if (!preflight.eligible()) {
            throw blocked(preflight, "GROUP_PURGE_BLOCKED_REFERENCES", "用户组不能清除");
        }
        validateConfirmation(group, request);
        validateVersion(group, request.getExpectedUpdatedAt());
        if (request.getExpectedArchivedAt() == null || !request.getExpectedArchivedAt().equals(group.getDeletedAt())) {
            throw error(409, "GROUP_VERSION_CONFLICT", "归档时间已变化");
        }
        String before = lifecycleJson(group, preflight, request.getReason(), "archived", null);
        try {
            int deleted = groupMapper.hardDeleteArchived(user.getTenantId(), groupId,
                request.getExpectedUpdatedAt());
            if (deleted != 1) throw error(409, "GROUP_VERSION_CONFLICT", "用户组状态或版本已变化");
        } catch (DataIntegrityViolationException exception) {
            throw error(409, "GROUP_PURGE_BLOCKED_REFERENCES", "数据库仍存在用户组引用");
        }
        String after = json(Map.of(
            "state", "purged",
            "groupRowExists", false,
            "reason", request.getReason()
        ));
        Long auditId = audit(user, groupId, "group_purge", before, after, request.getReason());
        return new GroupLifecycleResult(groupId, "purged", true, auditId, false);
    }

    private GroupLifecyclePreflightVO buildPreflight(Group group, String action) {
        List<GroupLifecycleBlocker> gateBlockers = lifecycleGateBlockers(group, action);
        GroupReferenceInventoryService.ReferenceSnapshot snapshot = referenceSnapshot(group, action, gateBlockers);
        List<GroupLifecycleBlocker> blockers = new ArrayList<>(gateBlockers);
        blockers.addAll(snapshot.blockers());
        LocalDateTime purgeEligibleAt = group.getDeletedAt() == null
            ? null : group.getDeletedAt().plusDays(purgeRetentionDays);
        String hash = hash(snapshot.activeCounts(), snapshot.historicalCounts());
        return new GroupLifecyclePreflightVO(
            action,
            blockers.isEmpty(),
            toGroupVO(group),
            snapshot.activeCounts(),
            snapshot.historicalCounts(),
            List.copyOf(blockers),
            purgeEligibleAt,
            "sha256:" + hash
        );
    }

    private GroupReferenceInventoryService.ReferenceSnapshot referenceSnapshot(
            Group group, String action, List<GroupLifecycleBlocker> gateBlockers) {
        boolean structurallyBlocked = gateBlockers.stream().anyMatch(blocker ->
            List.of("GROUP_BUILTIN_PROTECTED", "GROUP_UNASSIGNED_PROTECTED",
                "GROUP_REFERENCE_INACTIVE", "GROUP_NOT_ARCHIVED").contains(blocker.reasonCode()));
        if (structurallyBlocked || ("archive".equals(action) && Boolean.TRUE.equals(group.getIsDeleted()))) {
            return new GroupReferenceInventoryService.ReferenceSnapshot(Map.of(), Map.of(), List.of());
        }
        return switch (action) {
            case "archive" -> inventoryService.snapshotForArchive(group.getTenantId(), group.getId());
            case "purge" -> inventoryService.snapshotForPurge(group.getTenantId(), group.getId());
            case "restore" -> new GroupReferenceInventoryService.ReferenceSnapshot(Map.of(), Map.of(), List.of());
            default -> throw error(400, "GROUP_LIFECYCLE_ACTION_INVALID", "不支持的生命周期操作");
        };
    }

    private List<GroupLifecycleBlocker> lifecycleGateBlockers(Group group, String action) {
        List<GroupLifecycleBlocker> blockers = new ArrayList<>();
        if ("unassigned".equals(group.getGroupType())) {
            blockers.add(blocker("GROUP_UNASSIGNED_PROTECTED", "protectedGroup",
                "未分配组不能执行生命周期操作", "未分配组必须保留"));
        } else if (Boolean.TRUE.equals(group.getIsBuiltin())) {
            blockers.add(blocker("GROUP_BUILTIN_PROTECTED", "protectedGroup",
                "内置用户组不能执行生命周期操作", "内置用户组必须保留"));
        } else if (!"business".equals(group.getGroupType())) {
            blockers.add(blocker("GROUP_REFERENCE_INACTIVE", "groupType",
                "仅 business 用户组支持生命周期操作", "选择活动 business 用户组"));
        }
        if (("restore".equals(action) || "purge".equals(action))
                && !Boolean.TRUE.equals(group.getIsDeleted())) {
            blockers.add(blocker("GROUP_NOT_ARCHIVED", "state",
                "用户组不是已归档状态", "先归档用户组"));
        }
        if ("restore".equals(action) && Boolean.TRUE.equals(group.getIsDeleted())
                && groupMapper.countActiveCodeConflict(group.getTenantId(), group.getCode(), group.getId()) > 0) {
            blockers.add(blocker("GROUP_RESTORE_CODE_CONFLICT", "activeCodeConflict",
                "存在相同 code 的活动用户组", "先处理活动用户组 code 冲突"));
        }
        if ("purge".equals(action) && Boolean.TRUE.equals(group.getIsDeleted())) {
            if (group.getDeletedAt() == null) {
                blockers.add(blocker("GROUP_PURGE_RETENTION_NOT_MET", "retention",
                    "用户组缺少归档时间，不能计算清除保留期", "先修复归档元数据后重新预检"));
            } else if (LocalDateTime.now().isBefore(group.getDeletedAt().plusDays(purgeRetentionDays))) {
                blockers.add(blocker("GROUP_PURGE_RETENTION_NOT_MET", "retention",
                    "用户组尚未达到清除保留期", "等待保留期届满后重新预检"));
            }
        }
        return blockers;
    }

    private GroupLifecycleBlocker blocker(String reasonCode, String referenceType,
                                           String message, String resolution) {
        return new GroupLifecycleBlocker(reasonCode, referenceType, 1, message, resolution);
    }

    private GroupLifecycleException blocked(GroupLifecyclePreflightVO preflight,
                                             String fallbackCode, String message) {
        String code = preflight.blockers().isEmpty()
            ? fallbackCode : directBlockerCode(preflight.blockers().getFirst(), fallbackCode);
        return new GroupLifecycleException(409, code, message, preflight);
    }

    private String directBlockerCode(GroupLifecycleBlocker blocker, String fallbackCode) {
        return List.of(
            "GROUP_BUILTIN_PROTECTED", "GROUP_UNASSIGNED_PROTECTED", "GROUP_REFERENCE_INACTIVE",
            "GROUP_NOT_ARCHIVED", "GROUP_RESTORE_CODE_CONFLICT", "GROUP_PURGE_RETENTION_NOT_MET",
            "GROUP_REFERENCE_INVENTORY_DRIFT"
        ).contains(blocker.reasonCode()) ? blocker.reasonCode() : fallbackCode;
    }

    private GroupLifecycleListVO toListVO(Group group) {
        Long memberCount = jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM sys_user_group_membership
            WHERE tenant_id=? AND group_id=? AND NOT is_deleted
            """, Long.class, group.getTenantId(), group.getId());
        List<String> preview = jdbcTemplate.queryForList("""
            SELECT COALESCE(NULLIF(u.real_name,''), u.username)
            FROM sys_user_group_membership m
            JOIN sys_user u ON u.id=m.user_id AND u.tenant_id=m.tenant_id AND NOT u.is_deleted
            WHERE m.tenant_id=? AND m.group_id=? AND NOT m.is_deleted
            ORDER BY m.is_primary DESC, m.id
            LIMIT 3
            """, String.class, group.getTenantId(), group.getId());
        String leaderName = group.getLeaderId() == null ? null : queryUserName(group.getTenantId(), group.getLeaderId());
        String archivedByName = group.getDeletedBy() == null ? null : queryUserName(group.getTenantId(), group.getDeletedBy());
        return new GroupLifecycleListVO(
            group.getId(), group.getTenantId(), group.getCode(), group.getName(), group.getDescription(),
            group.getLeaderId(), leaderName, group.getGroupType(), Boolean.TRUE.equals(group.getIsBuiltin()),
            memberCount == null ? 0 : memberCount.intValue(), preview,
            Boolean.TRUE.equals(group.getIsDeleted()) ? "archived" : "active",
            group.getDeletedAt(), group.getDeletedBy(), archivedByName, group.getUpdatedAt()
        );
    }

    private String queryUserName(String tenantId, Long userId) {
        List<String> names = jdbcTemplate.queryForList("""
            SELECT COALESCE(NULLIF(real_name,''), username)
            FROM sys_user WHERE tenant_id=? AND id=?
            """, String.class, tenantId, userId);
        return names.isEmpty() ? null : names.getFirst();
    }

    private void requirePermissionAndScope(String action, SecurityUser user) {
        String permission = switch (action) {
            case "read" -> "group:read";
            case "archive" -> "group:delete";
            case "restore" -> "group:update";
            case "purge" -> "group:purge";
            default -> throw error(400, "GROUP_LIFECYCLE_ACTION_INVALID", "不支持的生命周期操作");
        };
        if (authorizationModeService.effectiveMode(user.getTenantId())
                == AuthorizationModeService.EffectiveMode.ENFORCED) {
            List<String> permissionScopes = roleAssignmentService.findEffectiveScopesForPermission(
                user.getUserId(), user.getTenantId(), permission);
            if (permissionScopes.isEmpty()) {
                throw error(403, "ACCESS_DENIED", "无权限执行用户组生命周期操作");
            }
            boolean allowed = "purge".equals(action)
                ? permissionScopes.contains("platform")
                : permissionScopes.stream().anyMatch(scope -> List.of("tenant", "platform").contains(scope));
            if (!allowed) {
                throw error(403, "GROUP_LIFECYCLE_SCOPE_DENIED",
                    "purge".equals(action) ? "清除用户组要求 platform scope" : "该操作要求 tenant 或 platform scope");
            }
            return;
        }
        if (!user.getPermissions().contains(permission)) {
            throw error(403, "ACCESS_DENIED", "无权限执行用户组生命周期操作");
        }
        if ("purge".equals(action) && !"platform".equals(user.getGroupScope())) {
            throw error(403, "GROUP_LIFECYCLE_SCOPE_DENIED", "清除用户组要求 platform scope");
        }
        if (!"purge".equals(action)) requireTenantScope(user);
    }

    private void requireTenantScope(SecurityUser user) {
        if (!List.of("tenant", "platform").contains(user.getGroupScope())) {
            throw error(403, "GROUP_LIFECYCLE_SCOPE_DENIED", "该操作要求 tenant 或 platform scope");
        }
    }

    private void validateAction(String action) {
        if (!ACTIONS.contains(action)) {
            throw error(400, "GROUP_LIFECYCLE_ACTION_INVALID", "不支持的生命周期操作");
        }
    }

    private void validateRequest(GroupLifecycleActionRequest request) {
        if (request == null) throw error(400, "GROUP_LIFECYCLE_REASON_INVALID", "请求不能为空");
        String reason = request.getReason() == null ? "" : request.getReason().trim();
        if (reason.length() < 10 || reason.length() > 500) {
            throw error(400, "GROUP_LIFECYCLE_REASON_INVALID", "操作原因长度必须为 10–500 个字符");
        }
        request.setReason(reason);
        if (request.getExpectedUpdatedAt() == null) {
            throw error(400, "GROUP_EXPECTED_UPDATED_AT_REQUIRED", "expectedUpdatedAt 必填");
        }
    }

    private void validateConfirmation(Group group, GroupLifecycleActionRequest request) {
        if (request.getConfirmationName() == null
                || !request.getConfirmationName().equals(group.getName())) {
            throw error(400, "GROUP_CONFIRMATION_MISMATCH", "确认名称与当前用户组名称不一致");
        }
    }

    private void validateVersion(Group group, LocalDateTime expectedUpdatedAt) {
        if (!expectedUpdatedAt.equals(group.getUpdatedAt())) {
            throw error(409, "GROUP_VERSION_CONFLICT", "用户组版本已变化，请重新预检");
        }
    }

    private Group lock(String tenantId, Long groupId) {
        Group group = groupMapper.lockByTenantAndIdIncludingDeleted(tenantId, groupId);
        if (group == null) throw error(404, "GROUP_NOT_FOUND", "用户组不存在");
        return group;
    }

    private Group requireIncludingDeleted(String tenantId, Long groupId) {
        Group group = groupMapper.findByTenantAndIdIncludingDeleted(tenantId, groupId);
        if (group == null) throw error(404, "GROUP_NOT_FOUND", "用户组不存在");
        return group;
    }

    private GroupLifecycleGroupVO toGroupVO(Group group) {
        return new GroupLifecycleGroupVO(
            group.getId(), group.getTenantId(), group.getCode(), group.getName(),
            Boolean.TRUE.equals(group.getIsDeleted()) ? "archived" : "active",
            group.getGroupType(), Boolean.TRUE.equals(group.getIsBuiltin()),
            group.getUpdatedAt(), group.getDeletedAt()
        );
    }

    private String lifecycleJson(Group group, GroupLifecyclePreflightVO preflight,
                                 String reason, String state, Map<String, Object> additions) {
        Map<String, Object> content = new LinkedHashMap<>();
        Map<String, Object> groupSnapshot = new LinkedHashMap<>();
        groupSnapshot.put("id", group.getId());
        groupSnapshot.put("tenantId", group.getTenantId());
        groupSnapshot.put("code", group.getCode());
        groupSnapshot.put("name", group.getName());
        groupSnapshot.put("groupType", group.getGroupType());
        groupSnapshot.put("builtin", Boolean.TRUE.equals(group.getIsBuiltin()));
        groupSnapshot.put("leaderId", group.getLeaderId());
        groupSnapshot.put("isDeleted", Boolean.TRUE.equals(group.getIsDeleted()));
        groupSnapshot.put("deletedAt", group.getDeletedAt());
        groupSnapshot.put("deletedBy", group.getDeletedBy());
        groupSnapshot.put("state", state);
        groupSnapshot.put("updatedAt", group.getUpdatedAt());
        groupSnapshot.put("updatedBy", group.getUpdatedBy());
        content.put("group", groupSnapshot);
        content.put("referenceSnapshot", Map.of(
            "activeCounts", preflight.activeCounts(),
            "historicalCounts", preflight.historicalCounts(),
            "snapshotHash", preflight.snapshotHash()
        ));
        content.put("reason", reason);
        if (additions != null) content.putAll(additions);
        return json(content);
    }

    private Long audit(SecurityUser user, Long groupId, String action,
                       String beforeJson, String afterJson, String reason) {
        AuditLog audit = AuditLog.builder()
            .tenantId(user.getTenantId())
            .module("group")
            .action(action)
            .targetId(groupId)
            .targetType("group")
            .operatorId(user.getUserId())
            .beforeJson(beforeJson)
            .afterJson(afterJson)
            .remark(boundedRemark(action + ": " + reason))
            .createdAt(LocalDateTime.now())
            .build();
        if (auditLogMapper.insert(audit) != 1) {
            throw new IllegalStateException("用户组生命周期审计写入失败");
        }
        return audit.getId();
    }

    private String boundedRemark(String value) {
        return value.length() <= 512 ? value : value.substring(0, 509) + "...";
    }

    private String hash(Map<String, Long> active, Map<String, Long> historical) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(json(Map.of("activeCounts", active, "historicalCounts", historical))
                    .getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 不可用", exception);
        }
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("用户组生命周期审计序列化失败", exception);
        }
    }

    private GroupLifecycleException error(int status, String code, String message) {
        return new GroupLifecycleException(status, code, message);
    }
}
