package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.module.authorization.dto.AuthorizationRelationshipCleanupResult;
import com.cwgsyw.platform.module.authorization.dto.RoleAclConversionResult;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class LegacyRoleAclRemediationService {
    private static final Map<String, SourceDefinition> SOURCES = Map.of(
        "wiki_space_acl", new SourceDefinition(
            "wiki_space_acl", "space_id", "wiki_space", "wiki_space", "name"),
        "wiki_page_acl", new SourceDefinition(
            "wiki_page_acl", "page_id", "wiki_page", "wiki_page", "title"),
        "shared_folder_acl", new SourceDefinition(
            "shared_folder_acl", "folder_id", "shared_folder", "shared_folder", "name")
    );

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public Map<SourceReference, RoleAclDetails> describeAll(
            String tenantId, List<SourceReference> references) {
        Map<SourceReference, RoleAclDetails> result = new LinkedHashMap<>();
        Map<SourceDefinition, Set<Long>> idsBySource = new LinkedHashMap<>();
        for (SourceReference reference : references) {
            ParsedSource parsed = parse(reference.sourceType(), reference.sourceKey());
            if (parsed == null) continue;
            result.put(reference, missingDetails(parsed.definition()));
            idsBySource.computeIfAbsent(parsed.definition(), ignored -> new LinkedHashSet<>()).add(parsed.aclId());
        }
        for (Map.Entry<SourceDefinition, Set<Long>> entry : idsBySource.entrySet()) {
            SourceDefinition definition = entry.getKey();
            List<Long> ids = new ArrayList<>(entry.getValue());
            String placeholders = String.join(", ", java.util.Collections.nCopies(ids.size(), "?"));
            String sql = """
                SELECT acl.id, acl.%s AS resource_id, acl.subject_type, acl.subject_id,
                       acl.permissions::text AS permissions, acl.is_deleted AS source_deleted,
                       role.id AS role_id, role.name AS role_name, role.code AS role_code,
                       role.is_deleted AS role_deleted,
                       resource.id AS joined_resource_id, resource.%s AS resource_name,
                       resource.is_deleted AS resource_deleted,
                       COALESCE(subject_users.active_users, 0) AS active_users
                FROM %s acl
                LEFT JOIN sys_role role
                  ON acl.subject_type = 'role' AND role.id = acl.subject_id
                 AND role.tenant_id = acl.tenant_id
                LEFT JOIN %s resource
                  ON resource.id = acl.%s AND resource.tenant_id = acl.tenant_id
                LEFT JOIN LATERAL (
                    SELECT COUNT(*) AS active_users
                    FROM (
                        SELECT legacy.user_id
                        FROM sys_user_role legacy
                        JOIN sys_user legacy_user ON legacy_user.id = legacy.user_id
                        WHERE legacy.role_id = acl.subject_id
                          AND legacy_user.tenant_id = acl.tenant_id
                          AND NOT legacy_user.is_deleted AND legacy_user.status = 1
                        UNION
                        SELECT assignment.user_id
                        FROM sys_role_assignment assignment
                        JOIN sys_user assigned_user ON assigned_user.id = assignment.user_id
                        WHERE assignment.role_id = acl.subject_id
                          AND assignment.tenant_id = acl.tenant_id
                          AND NOT assignment.is_deleted
                          AND NOT assigned_user.is_deleted AND assigned_user.status = 1
                          AND (assignment.valid_from IS NULL OR assignment.valid_from <= NOW())
                          AND (assignment.valid_until IS NULL OR assignment.valid_until > NOW())
                    ) effective_users
                ) subject_users ON TRUE
                WHERE acl.tenant_id = ? AND acl.id IN (%s)
                """.formatted(definition.resourceIdColumn(), definition.resourceNameColumn(),
                definition.sourceTable(), definition.resourceTable(), definition.resourceIdColumn(), placeholders);
            List<Object> arguments = new ArrayList<>();
            arguments.add(tenantId);
            arguments.addAll(ids);
            jdbcTemplate.query(sql, rs -> {
                long aclId = rs.getLong("id");
                SourceReference reference = new SourceReference(
                    definition.sourceTable(), definition.sourceTable() + ":" + aclId);
                Long roleId = nullableLong(rs.getObject("role_id"));
                boolean sourceActive = !rs.getBoolean("source_deleted")
                    && "role".equals(rs.getString("subject_type"));
                boolean roleActive = roleId != null && !rs.getBoolean("role_deleted");
                boolean resourceActive = rs.getObject("joined_resource_id") != null
                    && !rs.getBoolean("resource_deleted");
                long activeUsers = roleActive ? rs.getLong("active_users") : 0;
                result.put(reference, new RoleAclDetails(
                    rs.getString("subject_type"), nullableLong(rs.getObject("subject_id")),
                    rs.getString("role_name"), rs.getString("role_code"), activeUsers,
                    definition.resourceType(), nullableLong(rs.getObject("resource_id")),
                    rs.getString("resource_name"), parsePermissions(rs.getString("permissions")),
                    sourceActive, resourceActive,
                    !sourceActive || !resourceActive || !roleActive || activeUsers == 0,
                    sourceActive && resourceActive && roleActive));
            }, arguments.toArray());
        }
        return result;
    }

    @Transactional
    public AuthorizationRelationshipCleanupResult cleanupEmptyRoleAcl(
            String tenantId, String sourceType, String sourceKey, Long operatorId) {
        ParsedSource parsed = requireParsedSource(sourceType, sourceKey);
        LegacyAclRow source = lockSource(tenantId, parsed);
        if (source == null || source.deleted() || !"role".equals(source.subjectType())) {
            return cleanupResult(0);
        }
        boolean roleActive = lockActiveRole(tenantId, source.subjectId());
        boolean resourceActive = lockActiveResource(tenantId, parsed.definition(), source.resourceId());
        long activeUsers = roleActive ? countEffectiveRoleUsers(tenantId, source.subjectId()) : 0;
        if (resourceActive && roleActive && activeUsers > 0) {
            throw new IllegalStateException("角色仍命中 " + activeUsers + " 个有效账户，请转换为指定用户或组");
        }
        int removed = jdbcTemplate.update("UPDATE " + parsed.definition().sourceTable()
                + " SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ?, updated_at = NOW()"
                + " WHERE id = ? AND tenant_id = ? AND subject_type = 'role' AND subject_id = ? AND NOT is_deleted",
            operatorId, parsed.aclId(), tenantId, source.subjectId());
        if (removed == 0) throw new IllegalStateException("角色 ACL 已变化，请刷新后重试");
        return cleanupResult(removed);
    }

    @Transactional
    public RoleAclConversionResult convert(
            String tenantId, String sourceType, String sourceKey,
            String targetSubjectType, Long targetSubjectId, Long operatorId) {
        ParsedSource parsed = requireParsedSource(sourceType, sourceKey);
        LegacyAclRow source = lockSource(tenantId, parsed);
        if (source == null || source.deleted()) throw new IllegalStateException("角色 ACL 已不存在，请刷新后重试");
        if (!"role".equals(source.subjectType())) throw new IllegalStateException("该 ACL 已不再是角色主体");
        if (!lockActiveRole(tenantId, source.subjectId())) {
            throw new IllegalStateException("源角色已失效，请使用系统清理");
        }
        if (!lockActiveResource(tenantId, parsed.definition(), source.resourceId())) {
            throw new IllegalStateException("对应资源已失效，请使用系统清理");
        }
        validateTargetSubject(tenantId, targetSubjectType, targetSubjectId);

        int updatedTargets = mergeExistingTarget(parsed.definition(), tenantId, source,
            targetSubjectType, targetSubjectId);
        if (updatedTargets == 0) {
            jdbcTemplate.update("INSERT INTO " + parsed.definition().sourceTable()
                    + " (tenant_id, " + parsed.definition().resourceIdColumn()
                    + ", subject_type, subject_id, permissions, created_by, created_at, updated_at, is_deleted)"
                    + " VALUES (?, ?, ?, ?, CAST(? AS jsonb), ?, NOW(), NOW(), FALSE)",
                tenantId, source.resourceId(), targetSubjectType, targetSubjectId,
                source.permissionsJson(), operatorId);
        }

        int resourceAclEntries = upsertResourceAcl(tenantId, parsed.definition(), source,
            targetSubjectType, targetSubjectId, operatorId);
        int removed = jdbcTemplate.update("UPDATE " + parsed.definition().sourceTable()
                + " SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ?, updated_at = NOW()"
                + " WHERE id = ? AND tenant_id = ? AND subject_type = 'role' AND subject_id = ? AND NOT is_deleted",
            operatorId, parsed.aclId(), tenantId, source.subjectId());
        if (removed == 0) throw new IllegalStateException("角色 ACL 已变化，请刷新后重试");
        return RoleAclConversionResult.builder()
            .sourceRoleId(source.subjectId())
            .resourceType(parsed.definition().resourceType())
            .resourceId(source.resourceId())
            .targetSubjectType(targetSubjectType)
            .targetSubjectId(targetSubjectId)
            .legacyAclEntries(1)
            .resourceAclEntries(resourceAclEntries)
            .build();
    }

    private int mergeExistingTarget(SourceDefinition definition, String tenantId, LegacyAclRow source,
                                    String targetSubjectType, Long targetSubjectId) {
        return jdbcTemplate.update("UPDATE " + definition.sourceTable() + " acl SET permissions = ("
                + " SELECT COALESCE(jsonb_agg(value ORDER BY value), '[]'::jsonb) FROM ("
                + " SELECT DISTINCT value FROM jsonb_array_elements_text(acl.permissions || CAST(? AS jsonb))"
                + " AS permission(value)) merged), updated_at = NOW()"
                + " WHERE acl.tenant_id = ? AND acl." + definition.resourceIdColumn() + " = ?"
                + " AND acl.subject_type = ? AND acl.subject_id = ? AND NOT acl.is_deleted",
            source.permissionsJson(), tenantId, source.resourceId(), targetSubjectType, targetSubjectId);
    }

    private int upsertResourceAcl(String tenantId, SourceDefinition definition, LegacyAclRow source,
                                  String targetSubjectType, Long targetSubjectId, Long operatorId) {
        int permissions = permissionBits(parsePermissions(source.permissionsJson()));
        return jdbcTemplate.update("""
            INSERT INTO resource_acl_entry
                (tenant_id, resource_type, resource_id, entry_type, subject_type,
                 subject_id, permissions, created_by, created_at, updated_at, is_deleted)
            VALUES (?, ?, ?, 'access', ?, ?, CAST(? AS SMALLINT), ?, NOW(), NOW(), FALSE)
            ON CONFLICT (tenant_id, resource_type, resource_id, entry_type, subject_type, subject_id)
                WHERE NOT is_deleted
            DO UPDATE SET permissions = resource_acl_entry.permissions | EXCLUDED.permissions,
                          updated_at = NOW(), updated_by = EXCLUDED.created_by
            """, tenantId, definition.resourceType(), source.resourceId(),
            targetSubjectType, targetSubjectId, permissions, operatorId);
    }

    private LegacyAclRow lockSource(String tenantId, ParsedSource parsed) {
        String sql = "SELECT " + parsed.definition().resourceIdColumn()
            + " AS resource_id, subject_type, subject_id, permissions::text, is_deleted"
            + " FROM " + parsed.definition().sourceTable()
            + " WHERE id = ? AND tenant_id = ? FOR UPDATE";
        return jdbcTemplate.query(sql, rs -> rs.next() ? new LegacyAclRow(
            nullableLong(rs.getObject("resource_id")), rs.getString("subject_type"),
            nullableLong(rs.getObject("subject_id")), rs.getString("permissions"),
            rs.getBoolean("is_deleted")) : null, parsed.aclId(), tenantId);
    }

    private void validateTargetSubject(String tenantId, String subjectType, Long subjectId) {
        if (subjectId == null || subjectId <= 0) throw new IllegalArgumentException("请选择目标用户或组");
        if ("user".equals(subjectType)) {
            if (count("""
                SELECT COUNT(*) FROM sys_user
                WHERE id = ? AND tenant_id = ? AND NOT is_deleted AND status = 1
                """, subjectId, tenantId) == 0) throw new IllegalArgumentException("目标用户不存在或已停用");
            return;
        }
        if ("group".equals(subjectType)) {
            if (count("""
                SELECT COUNT(*) FROM sys_group
                WHERE id = ? AND tenant_id = ? AND NOT is_deleted AND group_type <> 'unassigned'
                """, subjectId, tenantId) == 0) throw new IllegalArgumentException("目标业务组不存在");
            return;
        }
        throw new IllegalArgumentException("角色 ACL 只能转换为指定用户或指定组");
    }

    private boolean lockActiveRole(String tenantId, Long roleId) {
        if (roleId == null) return false;
        try {
            return jdbcTemplate.queryForObject("""
                SELECT id FROM sys_role
                WHERE id = ? AND tenant_id = ? AND NOT is_deleted
                FOR UPDATE
                """, Long.class, roleId, tenantId) != null;
        } catch (EmptyResultDataAccessException ignored) {
            return false;
        }
    }

    private boolean lockActiveResource(String tenantId, SourceDefinition definition, Long resourceId) {
        if (resourceId == null) return false;
        try {
            return jdbcTemplate.queryForObject("SELECT id FROM " + definition.resourceTable()
                + " WHERE id = ? AND tenant_id = ? AND NOT is_deleted FOR UPDATE",
                Long.class, resourceId, tenantId) != null;
        } catch (EmptyResultDataAccessException ignored) {
            return false;
        }
    }

    private long countEffectiveRoleUsers(String tenantId, Long roleId) {
        return count("""
            SELECT COUNT(*) FROM (
                SELECT legacy.user_id
                FROM sys_user_role legacy
                JOIN sys_user legacy_user ON legacy_user.id = legacy.user_id
                WHERE legacy.role_id = ? AND legacy_user.tenant_id = ?
                  AND NOT legacy_user.is_deleted AND legacy_user.status = 1
                UNION
                SELECT assignment.user_id
                FROM sys_role_assignment assignment
                JOIN sys_user assigned_user ON assigned_user.id = assignment.user_id
                WHERE assignment.role_id = ? AND assignment.tenant_id = ?
                  AND NOT assignment.is_deleted
                  AND NOT assigned_user.is_deleted AND assigned_user.status = 1
                  AND (assignment.valid_from IS NULL OR assignment.valid_from <= NOW())
                  AND (assignment.valid_until IS NULL OR assignment.valid_until > NOW())
            ) effective_users
            """, roleId, tenantId, roleId, tenantId);
    }

    private ParsedSource requireParsedSource(String sourceType, String sourceKey) {
        ParsedSource parsed = parse(sourceType, sourceKey);
        if (parsed == null) throw new IllegalArgumentException("角色 ACL 来源键无效");
        return parsed;
    }

    private ParsedSource parse(String sourceType, String sourceKey) {
        SourceDefinition definition = SOURCES.get(sourceType);
        if (definition == null || sourceKey == null || !sourceKey.startsWith(sourceType + ":")) return null;
        try {
            long aclId = Long.parseLong(sourceKey.substring(sourceType.length() + 1));
            return aclId > 0 ? new ParsedSource(definition, aclId) : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private RoleAclDetails missingDetails(SourceDefinition definition) {
        return new RoleAclDetails("role", null, null, null, 0,
            definition.resourceType(), null, null, List.of(), false, false, true, false);
    }

    private List<String> parsePermissions(String permissionsJson) {
        if (permissionsJson == null || permissionsJson.isBlank()) return List.of();
        try {
            return objectMapper.readValue(permissionsJson, new TypeReference<>() {});
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private int permissionBits(List<String> permissions) {
        int bits = 0;
        if (permissions.contains("read")) bits |= 4;
        if (permissions.stream().anyMatch(permission -> List.of(
                "write", "create", "update", "delete", "publish").contains(permission))) bits |= 2;
        if (bits != 0) bits |= 1;
        return bits;
    }

    private AuthorizationRelationshipCleanupResult cleanupResult(long removed) {
        return AuthorizationRelationshipCleanupResult.builder()
            .legacyAclEntries(removed)
            .totalRelationships(removed)
            .build();
    }

    private long count(String sql, Object... args) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }

    private static Long nullableLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    public record SourceReference(String sourceType, String sourceKey) {}

    public record RoleAclDetails(
        String subjectType,
        Long subjectId,
        String subjectName,
        String subjectCode,
        long activeSubjectUsers,
        String resourceType,
        Long resourceId,
        String resourceName,
        List<String> permissions,
        boolean sourceActive,
        boolean resourceActive,
        boolean canSystemCleanup,
        boolean canConvert
    ) {}

    private record SourceDefinition(
        String sourceTable,
        String resourceIdColumn,
        String resourceType,
        String resourceTable,
        String resourceNameColumn
    ) {}

    private record ParsedSource(SourceDefinition definition, long aclId) {}

    private record LegacyAclRow(
        Long resourceId,
        String subjectType,
        Long subjectId,
        String permissionsJson,
        boolean deleted
    ) {}
}
