package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.module.authorization.dto.AuthorizationMigrationResult;
import com.cwgsyw.platform.module.authorization.dto.ResourceMigrationRequest;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthorizationResourceMigrationService {
    private final JdbcTemplate jdbcTemplate;
    private final ActiveGroupReferenceValidator activeGroupReferenceValidator;

    @Transactional
    public AuthorizationMigrationResult backfill(String tenantId, String module, ResourceMigrationRequest request,
                                                 Long operatorId, String operatorScope) {
        requirePlatformAdministrator(operatorScope);
        if (!List.of("wiki", "shared_file").contains(module)) {
            throw new IllegalArgumentException("不支持的资源模块");
        }
        validateSystemOwner(tenantId, request);
        String runId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
            INSERT INTO authorization_migration_run
                (run_id, migration_type, source_snapshot_at, status, started_at)
            VALUES (?, ?, NOW(), 'running', NOW())
            """, runId, module + "_resource");

        MigrationCounts counts = "wiki".equals(module)
            ? migrateWiki(runId, tenantId, request, operatorId)
            : migrateSharedFiles(runId, tenantId, request, operatorId);
        String status = counts.errors() == 0 ? "reconciled" : "prepared";
        jdbcTemplate.update("""
            UPDATE authorization_migration_run
            SET source_count = ?, migrated_count = ?, skipped_count = ?, error_count = ?,
                status = ?, finished_at = NOW()
            WHERE run_id = ?
            """, counts.source(), counts.migrated(), counts.skipped(), counts.errors(), status, runId);
        return AuthorizationMigrationResult.builder()
            .runId(runId).sourceCount(counts.source()).migratedCount(counts.migrated())
            .skippedCount(counts.skipped()).errorCount(counts.errors()).status(status).build();
    }

    public void requireReadyForEnforcement(String tenantId, String module, Long userId) {
        String[] tables = "wiki".equals(module)
            ? new String[]{"wiki_space", "wiki_page"}
            : new String[]{"shared_folder", "shared_file"};
        for (String table : tables) {
            long incomplete = count("SELECT COUNT(*) FROM " + table + " WHERE tenant_id = ? AND NOT is_deleted "
                + "AND (owner_user_id IS NULL OR owner_group_id IS NULL OR permission_mode IS NULL)", tenantId);
            if (incomplete > 0) throw new IllegalStateException("资源权限字段尚未完成回填: " + table);
        }
        String[] aclTables = "wiki".equals(module)
            ? new String[]{"wiki_space_acl", "wiki_page_acl"}
            : new String[]{"shared_folder_acl"};
        for (String aclTable : aclTables) {
            long roleAclCount = count("SELECT COUNT(*) FROM " + aclTable
                + " WHERE tenant_id = ? AND NOT is_deleted AND subject_type = 'role'", tenantId);
            if (roleAclCount > 0) throw new IllegalStateException("仍存在 role 类型旧 ACL: " + aclTable);
        }
        long exceptions = count("""
            SELECT COUNT(*) FROM authorization_migration_exception
            WHERE tenant_id = ? AND user_id = ? AND resolution_status <> 'resolved'
            """, tenantId, userId);
        if (exceptions > 0) throw new IllegalStateException("账户仍有未解决或保留 legacy 的迁移异常");
        long diffs = count("""
            SELECT COUNT(*) FROM (
                SELECT DISTINCT ON (permission_code, resource_type, resource_id)
                    legacy_allowed, new_allowed
                FROM authorization_decision_diff
                WHERE tenant_id = ? AND user_id = ? AND module = ?
                ORDER BY permission_code, resource_type, resource_id, observed_at DESC, id DESC
            ) latest
            WHERE legacy_allowed <> new_allowed
            """, tenantId, userId, module);
        if (diffs > 0) throw new IllegalStateException("账户仍存在未解决的 shadow 判定差异");
    }

    public void initializeCreatedResource(String tenantId, String resourceType, Long resourceId,
                                          Long ownerUserId, Long ownerGroupId, Integer mode) {
        String table = table(resourceType);
        ResourceDescriptor parent = createdResourceParent(tenantId, resourceType, resourceId);
        if (parent != null && parent.getPermissionMode() != null
                && (parent.getPermissionMode() & 02000) != 0) {
            ownerGroupId = parent.getOwnerGroupId();
        }
        TreeSet<Long> groupIds = new TreeSet<>();
        if (ownerGroupId != null) groupIds.add(ownerGroupId);
        if (parent != null) {
            groupIds.addAll(jdbcTemplate.queryForList("""
                SELECT subject_id FROM resource_acl_entry
                WHERE tenant_id = ? AND resource_type = ? AND resource_id = ?
                  AND entry_type = 'default' AND subject_type = 'group' AND NOT is_deleted
                ORDER BY subject_id
                """, Long.class, parent.getTenantId(), parent.getResourceType(), parent.getResourceId()));
        }
        groupIds.forEach(groupId -> activeGroupReferenceValidator.lockAndRequire(tenantId, groupId));
        jdbcTemplate.update("UPDATE " + table + " SET owner_user_id = ?, owner_group_id = ?, permission_mode = ? "
            + "WHERE id = ? AND tenant_id = ?", ownerUserId, ownerGroupId, mode, resourceId, tenantId);
        if (parent != null) copyDefaultAcl(parent, resourceType, resourceId, ownerUserId);
    }

    private ResourceDescriptor createdResourceParent(String tenantId, String resourceType, Long resourceId) {
        return switch (resourceType) {
            case "wiki_page" -> jdbcTemplate.query("""
                    SELECT parent_id, space_id FROM wiki_page
                    WHERE id = ? AND tenant_id = ? AND NOT is_deleted
                    """, rs -> {
                        if (!rs.next()) return null;
                        Long parentId = nullableLong(rs.getObject("parent_id"));
                        return parentId == null
                            ? descriptor(tenantId, "wiki_space", rs.getLong("space_id"))
                            : descriptor(tenantId, "wiki_page", parentId);
                    }, resourceId, tenantId);
            case "shared_folder" -> parentByColumn(tenantId, "shared_folder", resourceId,
                "parent_id", "shared_folder");
            case "shared_file" -> parentByColumn(tenantId, "shared_file", resourceId,
                "folder_id", "shared_folder");
            default -> null;
        };
    }

    private ResourceDescriptor parentByColumn(String tenantId, String table, Long resourceId,
                                              String parentColumn, String parentType) {
        Long parentId = jdbcTemplate.query("SELECT " + parentColumn + " FROM " + table
                + " WHERE id = ? AND tenant_id = ? AND NOT is_deleted",
            rs -> rs.next() ? nullableLong(rs.getObject(1)) : null, resourceId, tenantId);
        return parentId == null ? null : descriptor(tenantId, parentType, parentId);
    }

    private ResourceDescriptor descriptor(String tenantId, String resourceType, Long resourceId) {
        String resourceTable = table(resourceType);
        return jdbcTemplate.query("SELECT owner_group_id, permission_mode FROM " + resourceTable
                + " WHERE id = ? AND tenant_id = ? AND NOT is_deleted",
            rs -> rs.next() ? ResourceDescriptor.builder().tenantId(tenantId).resourceType(resourceType)
                .resourceId(resourceId).ownerGroupId(nullableLong(rs.getObject("owner_group_id")))
                .permissionMode(nullableInteger(rs.getObject("permission_mode"))).build() : null,
            resourceId, tenantId);
    }

    private void copyDefaultAcl(ResourceDescriptor parent, String resourceType, Long resourceId, Long operatorId) {
        jdbcTemplate.update("""
            INSERT INTO resource_acl_entry
                (tenant_id, resource_type, resource_id, entry_type, subject_type,
                 subject_id, permissions, created_by)
            SELECT tenant_id, ?, ?, 'access', subject_type, subject_id, permissions, ?
            FROM resource_acl_entry
            WHERE tenant_id = ? AND resource_type = ? AND resource_id = ?
              AND entry_type = 'default' AND NOT is_deleted
            ON CONFLICT (tenant_id, resource_type, resource_id, entry_type, subject_type, subject_id)
                WHERE NOT is_deleted
            DO NOTHING
            """, resourceType, resourceId, operatorId, parent.getTenantId(),
            parent.getResourceType(), parent.getResourceId());
    }

    private MigrationCounts migrateWiki(String runId, String tenantId,
                                        ResourceMigrationRequest request, Long operatorId) {
        long spaces = updateOwners(tenantId, "wiki_space", request, "CASE WHEN seed_key IS NULL THEN 1528 ELSE 493 END");
        long pages = updateOwners(tenantId, "wiki_page", request, "CASE WHEN seed_key IS NULL THEN 440 ELSE 421 END");
        MigrationCounts spaceAcl = migrateAcl(runId, tenantId, "wiki_space_acl", "space_id", "wiki_space", true, operatorId);
        MigrationCounts pageAcl = migrateAcl(runId, tenantId, "wiki_page_acl", "page_id", "wiki_page", false, operatorId);
        return new MigrationCounts(spaces + pages + spaceAcl.source() + pageAcl.source(),
            spaces + pages + spaceAcl.migrated() + pageAcl.migrated(),
            spaceAcl.skipped() + pageAcl.skipped(), spaceAcl.errors() + pageAcl.errors());
    }

    private MigrationCounts migrateSharedFiles(String runId, String tenantId,
                                               ResourceMigrationRequest request, Long operatorId) {
        long folders = updateOwners(tenantId, "shared_folder", request, "1528");
        long files = updateOwners(tenantId, "shared_file", request, "432");
        MigrationCounts folderAcl = migrateAcl(runId, tenantId, "shared_folder_acl", "folder_id", "shared_folder", true, operatorId);
        return new MigrationCounts(folders + files + folderAcl.source(),
            folders + files + folderAcl.migrated(), folderAcl.skipped(), folderAcl.errors());
    }

    private long updateOwners(String tenantId, String table,
                              ResourceMigrationRequest request, String modeExpression) {
        return jdbcTemplate.update("""
            UPDATE %s resource
            SET owner_user_id = COALESCE((
                    SELECT u.id FROM sys_user u
                    WHERE u.id = resource.created_by AND u.tenant_id = resource.tenant_id AND NOT u.is_deleted
                ), ?),
                owner_group_id = COALESCE((
                    SELECT g.id FROM sys_user u
                    JOIN sys_group g ON g.id = u.group_id
                    WHERE u.id = resource.created_by AND u.tenant_id = resource.tenant_id
                      AND NOT u.is_deleted AND g.tenant_id = resource.tenant_id AND NOT g.is_deleted
                      AND g.group_type <> 'unassigned'
                ), ?),
                permission_mode = %s
            WHERE resource.tenant_id = ?
              AND (resource.owner_user_id IS NULL OR resource.owner_group_id IS NULL OR resource.permission_mode IS NULL)
            """.formatted(table, modeExpression), request.getSystemOwnerUserId(), request.getSystemOwnerGroupId(), tenantId);
    }

    private MigrationCounts migrateAcl(String runId, String tenantId,
                                       String sourceTable, String resourceIdColumn,
                                       String resourceType, boolean container, Long operatorId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("SELECT id, tenant_id, " + resourceIdColumn
            + " AS resource_id, subject_type, subject_id, permissions::text FROM " + sourceTable
            + " WHERE tenant_id = ? AND NOT is_deleted", tenantId);
        long migrated = 0;
        long skipped = 0;
        long errors = 0;
        rows.stream().filter(row -> "group".equals(String.valueOf(row.get("subject_type"))))
            .map(row -> number(row.get("subject_id"))).filter(java.util.Objects::nonNull)
            .distinct().sorted()
            .forEach(groupId -> activeGroupReferenceValidator.lockAndRequire(tenantId, groupId));
        for (Map<String, Object> row : rows) {
            String subjectType = String.valueOf(row.get("subject_type"));
            Long sourceId = number(row.get("id"));
            Long resourceId = number(row.get("resource_id"));
            if ("role".equals(subjectType)) {
                insertException(runId, tenantId, null, sourceTable,
                    sourceTable + ":" + sourceId, "ROLE_ACL_NEEDS_REVIEW");
                errors++;
                continue;
            }
            if (!List.of("user", "group").contains(subjectType)) {
                skipped++;
                continue;
            }
            int permissions = permissionBits(String.valueOf(row.get("permissions")), container);
            jdbcTemplate.update("""
                INSERT INTO resource_acl_entry
                    (tenant_id, resource_type, resource_id, entry_type, subject_type,
                     subject_id, permissions, created_by)
                VALUES (?, ?, ?, 'access', ?, ?, ?, ?)
                ON CONFLICT (tenant_id, resource_type, resource_id, entry_type, subject_type, subject_id)
                    WHERE NOT is_deleted
                DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = NOW()
                """, tenantId, resourceType, resourceId, subjectType, number(row.get("subject_id")),
                permissions, operatorId);
            migrated++;
        }
        return new MigrationCounts(rows.size(), migrated, skipped, errors);
    }

    private int permissionBits(String json, boolean container) {
        int bits = 0;
        if (json.contains("read")) bits |= 4;
        if (json.contains("write") || json.contains("create") || json.contains("update")
                || json.contains("delete") || json.contains("publish")) bits |= 2;
        if (container && bits != 0) bits |= 1;
        return bits;
    }

    private void validateSystemOwner(String tenantId, ResourceMigrationRequest request) {
        long ownerCount = count("SELECT COUNT(*) FROM sys_user WHERE id = ? AND tenant_id = ? AND NOT is_deleted",
            request.getSystemOwnerUserId(), tenantId);
        if (ownerCount == 0) throw new IllegalArgumentException("系统 owner 用户不存在");
        activeGroupReferenceValidator.lockAndRequire(tenantId, request.getSystemOwnerGroupId());
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

    private String table(String resourceType) {
        return switch (resourceType) {
            case "wiki_space" -> "wiki_space";
            case "wiki_page" -> "wiki_page";
            case "shared_folder" -> "shared_folder";
            case "shared_file" -> "shared_file";
            default -> throw new IllegalArgumentException("不支持的资源类型");
        };
    }

    private long count(String sql, Object... args) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }

    private Long number(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private Long nullableLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private Integer nullableInteger(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }

    private void requirePlatformAdministrator(String scope) {
        if (!"platform".equals(scope)) throw new IllegalArgumentException("仅超级管理员可以迁移资源权限");
    }

    private record MigrationCounts(long source, long migrated, long skipped, long errors) {}
}
