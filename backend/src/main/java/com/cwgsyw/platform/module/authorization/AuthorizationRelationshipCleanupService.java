package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.module.authorization.dto.AuthorizationRelationshipCleanupResult;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthorizationRelationshipCleanupService {
    private final JdbcTemplate jdbcTemplate;
    private final AuthorizationWriteLockService authorizationWriteLockService;

    public void requireNoOwnedResources(String tenantId, Long userId) {
        long ownedResources = count("""
            SELECT COUNT(*) FROM (
                SELECT id FROM wiki_space
                WHERE tenant_id = ? AND owner_user_id = ? AND NOT is_deleted
                UNION ALL SELECT id FROM wiki_page
                WHERE tenant_id = ? AND owner_user_id = ? AND NOT is_deleted
                UNION ALL SELECT id FROM shared_folder
                WHERE tenant_id = ? AND owner_user_id = ? AND NOT is_deleted
                UNION ALL SELECT id FROM shared_file
                WHERE tenant_id = ? AND owner_user_id = ? AND NOT is_deleted
            ) owned_resources
            """, tenantId, userId, tenantId, userId, tenantId, userId, tenantId, userId);
        if (ownedResources > 0) {
            throw new IllegalStateException("该账户仍是 " + ownedResources + " 个 Wiki 或共享文档资源的属主，请先转移属主");
        }
    }

    @Transactional
    public AuthorizationRelationshipCleanupResult cleanupDeletedUser(String tenantId, Long userId, Long operatorId) {
        if (count("SELECT COUNT(*) FROM sys_user WHERE tenant_id = ? AND id = ? AND is_deleted", tenantId, userId) == 0) {
            throw new IllegalStateException("仅允许清理已删除账户的授权关系");
        }
        lockActiveGroupRelationships(tenantId, userId, null);
        int roleAssignments = jdbcTemplate.update("""
            UPDATE sys_role_assignment
            SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ?, updated_at = NOW(), updated_by = ?
            WHERE tenant_id = ? AND user_id = ? AND NOT is_deleted
            """, operatorId, operatorId, tenantId, userId);
        int groupMemberships = jdbcTemplate.update("""
            UPDATE sys_user_group_membership
            SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ?, updated_at = NOW(), updated_by = ?
            WHERE tenant_id = ? AND user_id = ? AND NOT is_deleted
            """, operatorId, operatorId, tenantId, userId);
        int groupLeaderships = jdbcTemplate.update("""
            UPDATE sys_group
            SET leader_id = NULL, updated_at = NOW(), updated_by = ?
            WHERE tenant_id = ? AND leader_id = ? AND NOT is_deleted
            """, operatorId, tenantId, userId);
        int resourceAclEntries = jdbcTemplate.update("""
            UPDATE resource_acl_entry
            SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ?, updated_at = NOW(), updated_by = ?
            WHERE tenant_id = ? AND subject_type = 'user' AND subject_id = ? AND NOT is_deleted
            """, operatorId, operatorId, tenantId, userId);
        AuthorizationRelationshipCleanupResult result = result(
            roleAssignments, groupMemberships, groupLeaderships, resourceAclEntries);
        jdbcTemplate.update("""
            INSERT INTO audit_log
                (tenant_id, module, action, target_id, target_type, operator_id, remark, created_at)
            VALUES (?, 'authorization', 'deleted_user_relationship_cleanup', ?, 'user', ?, ?, NOW())
            """, tenantId, userId, operatorId,
            "relationships=" + result.getTotalRelationships());
        return result;
    }

    private void lockActiveGroupRelationships(String tenantId, Long userId, Long roleId) {
        authorizationWriteLockService.lockUserAuthorization(tenantId, userId);
        List<Long> roleIds = jdbcTemplate.queryForList("""
            SELECT role_id FROM sys_role_assignment
            WHERE tenant_id = ? AND user_id = ? AND NOT is_deleted
            """, Long.class, tenantId, userId);
        roleIds.stream().distinct().sorted()
            .forEach(affectedRoleId -> authorizationWriteLockService.lockRoleAuthorization(
                tenantId, affectedRoleId));
        List<Long> groupIds = jdbcTemplate.queryForList("""
            SELECT group_id FROM (
                SELECT m.group_id
                FROM sys_user_group_membership m
                WHERE m.tenant_id = ? AND m.user_id = ? AND NOT m.is_deleted
                UNION
                SELECT a.scope_id AS group_id
                FROM sys_role_assignment a
                WHERE a.tenant_id = ? AND a.user_id = ? AND NOT a.is_deleted
                  AND a.scope_type = 'group' AND a.scope_id IS NOT NULL
            ) active_group_relationships
            """, Long.class, tenantId, userId, tenantId, userId);
        groupIds.stream().distinct().sorted(Comparator.naturalOrder())
            .forEach(groupId -> authorizationWriteLockService.lockGroupAssignment(
                tenantId, userId, groupId));
    }

    private AuthorizationRelationshipCleanupResult result(long roleAssignments, long groupMemberships,
                                                          long groupLeaderships, long resourceAclEntries) {
        long totalRelationships = roleAssignments + groupMemberships + groupLeaderships + resourceAclEntries;
        return AuthorizationRelationshipCleanupResult.builder()
            .roleAssignments(roleAssignments)
            .groupMemberships(groupMemberships)
            .groupLeaderships(groupLeaderships)
            .resourceAclEntries(resourceAclEntries)
            .totalRelationships(totalRelationships)
            .build();
    }

    private long count(String sql, Object... args) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }
}
