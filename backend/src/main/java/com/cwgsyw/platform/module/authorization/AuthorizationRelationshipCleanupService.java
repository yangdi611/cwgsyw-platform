package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.module.authorization.dto.AuthorizationRelationshipCleanupResult;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthorizationRelationshipCleanupService {
    private final JdbcTemplate jdbcTemplate;

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
        int legacyUserRoles = jdbcTemplate.update("DELETE FROM sys_user_role WHERE user_id = ?", userId);
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
        int legacyAclEntries = 0;
        for (String table : new String[]{"wiki_space_acl", "wiki_page_acl", "shared_folder_acl"}) {
            legacyAclEntries += jdbcTemplate.update("UPDATE " + table + " SET is_deleted = TRUE, "
                + "deleted_at = NOW(), deleted_by = ?, updated_at = NOW() "
                + "WHERE tenant_id = ? AND subject_type = 'user' AND subject_id = ? AND NOT is_deleted",
                operatorId, tenantId, userId);
        }
        int resolvedExceptions = jdbcTemplate.update("""
            UPDATE authorization_migration_exception
            SET resolution_status = 'resolved',
                resolution_note = '账户已删除，授权关系已由系统自动撤销',
                resolved_by = ?, resolved_at = NOW()
            WHERE tenant_id = ? AND user_id = ? AND resolution_status <> 'resolved'
            """, operatorId, tenantId, userId);
        AuthorizationRelationshipCleanupResult result = result(
            legacyUserRoles, roleAssignments, groupMemberships, groupLeaderships,
            resourceAclEntries, legacyAclEntries, resolvedExceptions);
        jdbcTemplate.update("""
            INSERT INTO audit_log
                (tenant_id, module, action, target_id, target_type, operator_id, remark, created_at)
            VALUES (?, 'authorization', 'deleted_user_relationship_cleanup', ?, 'user', ?, ?, NOW())
            """, tenantId, userId, operatorId,
            "relationships=" + result.getTotalRelationships() + "; exceptions=" + resolvedExceptions);
        return result;
    }

    public boolean isInvalidOrphanLegacyRole(String tenantId, Long userId, Long roleId) {
        return count("""
            SELECT COUNT(*) FROM sys_user_role ur
            LEFT JOIN sys_user u ON u.id = ur.user_id
            LEFT JOIN sys_role r ON r.id = ur.role_id
            WHERE ur.user_id = ? AND ur.role_id = ?
              AND (u.id IS NULL OR r.id IS NULL OR u.is_deleted OR r.is_deleted OR u.tenant_id <> r.tenant_id)
              AND (u.tenant_id = ? OR r.tenant_id = ?)
            """, userId, roleId, tenantId, tenantId) > 0;
    }

    @Transactional
    public AuthorizationRelationshipCleanupResult cleanupOrphanLegacyRole(
            String tenantId, Long userId, Long roleId, Long operatorId) {
        if (count("SELECT COUNT(*) FROM sys_user_role WHERE user_id = ? AND role_id = ?", userId, roleId) == 0) {
            return result(0, 0, 0, 0, 0, 0, 0);
        }
        if (!isInvalidOrphanLegacyRole(tenantId, userId, roleId)) {
            throw new IllegalStateException("该遗留角色关系当前有效，系统拒绝清理");
        }
        int roleAssignments = jdbcTemplate.update("""
            UPDATE sys_role_assignment
            SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ?, updated_at = NOW(), updated_by = ?
            WHERE tenant_id = ? AND user_id = ? AND role_id = ? AND NOT is_deleted
              AND EXISTS (
                  SELECT 1 FROM (VALUES (1)) AS anchor(value)
                  LEFT JOIN sys_user u ON u.id = ?
                  LEFT JOIN sys_role r ON r.id = ?
                  WHERE (u.id IS NULL OR r.id IS NULL OR u.is_deleted OR r.is_deleted
                         OR u.tenant_id <> r.tenant_id)
              )
            """, operatorId, operatorId, tenantId, userId, roleId, userId, roleId);
        int legacyUserRoles = jdbcTemplate.update("""
            DELETE FROM sys_user_role ur
            WHERE ur.user_id = ? AND ur.role_id = ?
              AND EXISTS (
                  SELECT 1 FROM (VALUES (1)) AS anchor(value)
                  LEFT JOIN sys_user u ON u.id = ?
                  LEFT JOIN sys_role r ON r.id = ?
                  WHERE (u.id IS NULL OR r.id IS NULL OR u.is_deleted OR r.is_deleted
                         OR u.tenant_id <> r.tenant_id)
                    AND (u.tenant_id = ? OR r.tenant_id = ?)
              )
            """, userId, roleId, userId, roleId, tenantId, tenantId);
        if (legacyUserRoles == 0) {
            throw new IllegalStateException("遗留角色关系已变化，请刷新后重试");
        }
        return result(legacyUserRoles, roleAssignments, 0, 0, 0, 0, 0);
    }

    private AuthorizationRelationshipCleanupResult result(
            long legacyUserRoles, long roleAssignments, long groupMemberships, long groupLeaderships,
            long resourceAclEntries, long legacyAclEntries, long resolvedExceptions) {
        long totalRelationships = legacyUserRoles + roleAssignments + groupMemberships
            + groupLeaderships + resourceAclEntries + legacyAclEntries;
        return AuthorizationRelationshipCleanupResult.builder()
            .legacyUserRoles(legacyUserRoles)
            .roleAssignments(roleAssignments)
            .groupMemberships(groupMemberships)
            .groupLeaderships(groupLeaderships)
            .resourceAclEntries(resourceAclEntries)
            .legacyAclEntries(legacyAclEntries)
            .resolvedExceptions(resolvedExceptions)
            .totalRelationships(totalRelationships)
            .build();
    }

    private long count(String sql, Object... args) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }
}
