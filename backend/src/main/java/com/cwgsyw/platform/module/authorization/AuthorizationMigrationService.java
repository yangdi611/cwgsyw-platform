package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.module.authorization.dto.AuthorizationMigrationResult;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationPreflightIssue;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationPreflightReport;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.RowCallbackHandler;

@Service
@RequiredArgsConstructor
public class AuthorizationMigrationService {
    private final JdbcTemplate jdbcTemplate;

    public AuthorizationPreflightReport preflight() {
        Map<String, Long> counts = new LinkedHashMap<>();
        counts.put("activeUsers", count("SELECT COUNT(*) FROM sys_user WHERE NOT is_deleted"));
        counts.put("activeGroups", count("SELECT COUNT(*) FROM sys_group WHERE NOT is_deleted"));
        counts.put("legacyUserRoles", count("SELECT COUNT(*) FROM sys_user_role"));
        counts.put("activeSuperAdmins", count("""
            SELECT COUNT(DISTINCT u.id)
            FROM sys_user u
            JOIN sys_user_role ur ON ur.user_id = u.id
            JOIN sys_role r ON r.id = ur.role_id
            WHERE NOT u.is_deleted AND u.status = 1 AND NOT r.is_deleted AND r.code = 'super_admin'
            """));

        List<AuthorizationPreflightIssue> issues = new ArrayList<>();
        queryIssues("""
            SELECT u.id AS user_id, 'sys_user.group_id:' || u.id AS source_key,
                   '主组不存在、已删除或跨租户' AS message
            FROM sys_user u
            LEFT JOIN sys_group g ON g.id = u.group_id
            WHERE NOT u.is_deleted AND u.group_id IS NOT NULL
              AND (g.id IS NULL OR g.is_deleted OR g.tenant_id <> u.tenant_id)
            """, "INVALID_PRIMARY_GROUP", issues);
        queryIssues("""
            SELECT g.leader_id AS user_id, 'sys_group.leader_id:' || g.id AS source_key,
                   '组长不存在、已删除或跨租户' AS message
            FROM sys_group g
            LEFT JOIN sys_user u ON u.id = g.leader_id
            WHERE NOT g.is_deleted AND g.leader_id IS NOT NULL
              AND (u.id IS NULL OR u.is_deleted OR u.tenant_id <> g.tenant_id)
            """, "INVALID_GROUP_LEADER", issues);
        queryIssues("""
            SELECT ur.user_id, 'sys_user_role:' || ur.user_id || ':' || ur.role_id AS source_key,
                   '用户角色关系存在孤儿或跨租户引用' AS message
            FROM sys_user_role ur
            LEFT JOIN sys_user u ON u.id = ur.user_id
            LEFT JOIN sys_role r ON r.id = ur.role_id
            WHERE u.id IS NULL OR r.id IS NULL OR u.is_deleted OR r.is_deleted
               OR u.tenant_id <> r.tenant_id
            """, "ORPHAN_USER_ROLE", issues);
        queryIssues("""
            SELECT u.id AS user_id, 'sys_user_role:' || ur.user_id || ':' || ur.role_id AS source_key,
                   'group scope 角色账户没有有效主组' AS message
            FROM sys_user_role ur
            JOIN sys_user u ON u.id = ur.user_id AND NOT u.is_deleted
            JOIN sys_role r ON r.id = ur.role_id AND NOT r.is_deleted
            LEFT JOIN sys_group g ON g.id = u.group_id AND NOT g.is_deleted
            WHERE r.scope = 'group'
              AND (u.group_id IS NULL OR g.id IS NULL OR g.tenant_id <> u.tenant_id)
            """, "GROUP_SCOPE_WITHOUT_GROUP", issues);
        queryIssues("""
            SELECT MIN(id) AS user_id, 'username:' || username AS source_key,
                   '同一 username 存在于多个 tenant，当前登录查询无法消歧' AS message
            FROM sys_user WHERE NOT is_deleted
            GROUP BY username HAVING COUNT(DISTINCT tenant_id) > 1
            """, "DUPLICATE_LOGIN_IDENTITY", issues);

        if (counts.get("activeSuperAdmins") == 0) {
            issues.add(new AuthorizationPreflightIssue(
                "NO_ACTIVE_SUPER_ADMIN", null, "super_admin", "没有活跃超级管理员，禁止迁移"));
        }
        boolean eligible = issues.stream().noneMatch(issue -> "NO_ACTIVE_SUPER_ADMIN".equals(issue.getReasonCode()));
        return AuthorizationPreflightReport.builder().eligible(eligible).counts(counts).issues(issues).build();
    }

    @Transactional
    public AuthorizationMigrationResult backfill(Long operatorId, String groupScope) {
        requirePlatformAdministrator(groupScope);
        AuthorizationPreflightReport preflight = preflight();
        if (!preflight.isEligible()) throw new IllegalStateException("授权迁移预检失败：缺少活跃超级管理员");

        String runId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
            INSERT INTO authorization_migration_run
                (run_id, migration_type, source_snapshot_at, status, started_at)
            VALUES (?, 'account_authorization', NOW(), 'running', NOW())
            """, runId);

        long sourceCount = 0;
        long migratedCount = 0;
        long skippedCount = 0;
        long errorCount = 0;

        List<Map<String, Object>> duplicateLoginUsers = jdbcTemplate.queryForList("""
            SELECT u.id, u.tenant_id, u.username
            FROM sys_user u
            JOIN (
                SELECT username FROM sys_user WHERE NOT is_deleted
                GROUP BY username HAVING COUNT(DISTINCT tenant_id) > 1
            ) duplicates ON duplicates.username = u.username
            WHERE NOT u.is_deleted
            ORDER BY u.id
            """);
        for (Map<String, Object> row : duplicateLoginUsers) {
            Long userId = longValue(row.get("id"));
            String tenantId = stringValue(row.get("tenant_id"));
            insertException(runId, tenantId, userId, "login_identity",
                "username:" + stringValue(row.get("username")) + ":" + userId,
                "DUPLICATE_LOGIN_IDENTITY");
            skippedCount++;
            errorCount++;
        }

        List<Map<String, Object>> users = jdbcTemplate.queryForList("""
            SELECT u.id, u.tenant_id, u.group_id, g.id AS valid_group_id
            FROM sys_user u
            LEFT JOIN sys_group g ON g.id = u.group_id AND NOT g.is_deleted AND g.tenant_id = u.tenant_id
            WHERE NOT u.is_deleted
            ORDER BY u.id
            """);
        for (Map<String, Object> row : users) {
            Long userId = longValue(row.get("id"));
            String tenantId = stringValue(row.get("tenant_id"));
            Long groupId = longValue(row.get("group_id"));
            if (groupId == null) continue;
            sourceCount++;
            if (row.get("valid_group_id") == null) {
                insertException(runId, tenantId, userId, "user_primary_group",
                    "sys_user.group_id:" + userId, "INVALID_PRIMARY_GROUP");
                errorCount++;
                continue;
            }
            Long targetId = upsertMembership(runId, tenantId, userId, groupId, "member", true, operatorId);
            insertLineage(runId, tenantId, "user_primary_group", "sys_user.group_id:" + userId,
                "membership", targetId, tenantId + ":" + userId + ":" + groupId);
            migratedCount++;
        }

        List<Map<String, Object>> leaders = jdbcTemplate.queryForList("""
            SELECT g.id AS group_id, g.tenant_id, g.leader_id,
                   u.id AS valid_user_id
            FROM sys_group g
            LEFT JOIN sys_user u ON u.id = g.leader_id AND NOT u.is_deleted AND u.tenant_id = g.tenant_id
            WHERE NOT g.is_deleted AND g.leader_id IS NOT NULL
            ORDER BY g.id
            """);
        for (Map<String, Object> row : leaders) {
            sourceCount++;
            Long groupId = longValue(row.get("group_id"));
            Long userId = longValue(row.get("leader_id"));
            String tenantId = stringValue(row.get("tenant_id"));
            if (row.get("valid_user_id") == null) {
                insertException(runId, tenantId, userId, "group_leader",
                    "sys_group.leader_id:" + groupId, "INVALID_GROUP_LEADER");
                errorCount++;
                continue;
            }
            boolean primary = count("SELECT COUNT(*) FROM sys_user WHERE id = ? AND group_id = ?", userId, groupId) > 0;
            Long targetId = upsertMembership(runId, tenantId, userId, groupId, "leader", primary, operatorId);
            insertLineage(runId, tenantId, "group_leader", "sys_group.leader_id:" + groupId,
                "membership", targetId, tenantId + ":" + userId + ":" + groupId + ":leader");
            migratedCount++;
        }

        List<Map<String, Object>> userRoles = jdbcTemplate.queryForList("""
            SELECT ur.user_id, ur.role_id, u.tenant_id AS user_tenant_id, u.group_id,
                   r.tenant_id AS role_tenant_id, r.scope, r.code,
                   CASE WHEN u.id IS NOT NULL AND NOT u.is_deleted THEN TRUE ELSE FALSE END AS valid_user,
                   CASE WHEN r.id IS NOT NULL AND NOT r.is_deleted THEN TRUE ELSE FALSE END AS valid_role
            FROM sys_user_role ur
            LEFT JOIN sys_user u ON u.id = ur.user_id
            LEFT JOIN sys_role r ON r.id = ur.role_id
            ORDER BY ur.user_id, ur.role_id
            """);
        for (Map<String, Object> row : userRoles) {
            sourceCount++;
            Long userId = longValue(row.get("user_id"));
            Long roleId = longValue(row.get("role_id"));
            String tenantId = stringValue(row.get("user_tenant_id"));
            String sourceKey = "sys_user_role:" + userId + ":" + roleId;
            if (!Boolean.TRUE.equals(row.get("valid_user")) || !Boolean.TRUE.equals(row.get("valid_role"))
                    || tenantId == null || !tenantId.equals(stringValue(row.get("role_tenant_id")))) {
                insertException(runId, tenantId == null ? "unknown" : tenantId, userId,
                    "user_role", sourceKey, "ORPHAN_USER_ROLE");
                errorCount++;
                continue;
            }
            String scope = stringValue(row.get("scope"));
            Long scopeId = "group".equals(scope) ? longValue(row.get("group_id")) : null;
            if ("group".equals(scope) && scopeId == null) {
                insertException(runId, tenantId, userId, "user_role", sourceKey,
                    "GROUP_SCOPE_WITHOUT_GROUP");
                errorCount++;
                continue;
            }
            if (!List.of("platform", "tenant", "group").contains(scope)) {
                insertException(runId, tenantId, userId, "user_role", sourceKey,
                    "INVALID_ROLE_SCOPE");
                errorCount++;
                continue;
            }
            Long targetId = upsertAssignment(runId, tenantId, userId, roleId, scope, scopeId, operatorId);
            insertLineage(runId, tenantId, "user_role", sourceKey, "role_assignment", targetId,
                tenantId + ":" + userId + ":" + roleId + ":" + scope + ":" + scopeId);
            for (String module : List.of("wiki", "shared_file")) {
                jdbcTemplate.update("""
                    INSERT INTO authorization_account_rollout
                        (tenant_id, user_id, module, migration_state, updated_at)
                    VALUES (?, ?, ?, 'shadow', NOW())
                    ON CONFLICT (tenant_id, user_id, module)
                    DO UPDATE SET migration_state = CASE
                        WHEN authorization_account_rollout.migration_state IN ('enforced', 'exception')
                            THEN authorization_account_rollout.migration_state
                        ELSE 'shadow' END,
                        updated_at = NOW()
                    """, tenantId, userId, module);
            }
            migratedCount++;
        }

        String status = errorCount == 0 ? "reconciled" : "prepared";
        jdbcTemplate.update("""
            UPDATE authorization_migration_run
            SET source_count = ?, migrated_count = ?, skipped_count = ?, error_count = ?,
                status = ?, finished_at = NOW()
            WHERE run_id = ?
            """, sourceCount, migratedCount, skippedCount, errorCount, status, runId);
        return AuthorizationMigrationResult.builder()
            .runId(runId)
            .sourceCount(sourceCount)
            .migratedCount(migratedCount)
            .skippedCount(skippedCount)
            .errorCount(errorCount)
            .status(status)
            .build();
    }

    private Long upsertMembership(String runId, String tenantId, Long userId, Long groupId,
                                  String role, boolean primary, Long operatorId) {
        return jdbcTemplate.queryForObject("""
            INSERT INTO sys_user_group_membership
                (tenant_id, user_id, group_id, membership_role, is_primary,
                 origin_type, origin_key, migration_run_id, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'migration', ?, ?, ?, NOW(), NOW())
            ON CONFLICT (tenant_id, user_id, group_id) WHERE NOT is_deleted
            DO UPDATE SET membership_role = CASE
                    WHEN EXCLUDED.membership_role = 'leader' THEN 'leader'
                    ELSE sys_user_group_membership.membership_role END,
                is_primary = sys_user_group_membership.is_primary OR EXCLUDED.is_primary,
                updated_at = NOW()
            RETURNING id
            """, Long.class, tenantId, userId, groupId, role, primary,
            "membership:" + tenantId + ":" + userId + ":" + groupId, runId, operatorId);
    }

    private Long upsertAssignment(String runId, String tenantId, Long userId, Long roleId,
                                  String scope, Long scopeId, Long operatorId) {
        return jdbcTemplate.queryForObject("""
            INSERT INTO sys_role_assignment
                (tenant_id, user_id, role_id, scope_type, scope_id, origin_type,
                 origin_key, migration_run_id, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'migration', ?, ?, ?, NOW(), NOW())
            ON CONFLICT (tenant_id, user_id, role_id, scope_type, (COALESCE(scope_id, 0)))
                WHERE NOT is_deleted
            DO UPDATE SET updated_at = NOW()
            RETURNING id
            """, Long.class, tenantId, userId, roleId, scope, scopeId,
            "sys_user_role:" + userId + ":" + roleId, runId, operatorId);
    }

    private void insertLineage(String runId, String tenantId, String sourceType, String sourceKey,
                               String targetType, Long targetId, String sourceValue) {
        jdbcTemplate.update("""
            INSERT INTO authorization_migration_lineage
                (run_id, tenant_id, source_type, source_key, target_type, target_id, source_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (run_id, source_type, source_key) DO NOTHING
            """, runId, tenantId, sourceType, sourceKey, targetType, targetId, sha256(sourceValue));
    }

    private void insertException(String runId, String tenantId, Long userId, String sourceType,
                                 String sourceKey, String reasonCode) {
        jdbcTemplate.update("""
            INSERT INTO authorization_migration_exception
                (run_id, tenant_id, user_id, source_type, source_key, reason_code)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (run_id, source_type, source_key) DO NOTHING
            """, runId, tenantId, userId, sourceType, sourceKey, reasonCode);
    }

    private void queryIssues(String sql, String reasonCode, List<AuthorizationPreflightIssue> issues) {
        jdbcTemplate.query(sql, (RowCallbackHandler) row -> issues.add(new AuthorizationPreflightIssue(
            reasonCode,
            longValue(row.getObject("user_id")),
            row.getString("source_key"),
            row.getString("message"))));
    }

    private long count(String sql, Object... args) {
        Long result = jdbcTemplate.queryForObject(sql, Long.class, args);
        return result == null ? 0 : result;
    }

    private void requirePlatformAdministrator(String groupScope) {
        if (!"platform".equals(groupScope)) {
            throw new IllegalArgumentException("仅超级管理员可以执行授权迁移");
        }
    }

    private Long longValue(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private String stringValue(Object value) {
        return value == null ? null : value.toString();
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
