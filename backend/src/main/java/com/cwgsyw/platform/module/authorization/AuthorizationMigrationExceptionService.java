package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationMigrationExceptionVO;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationRelationshipCleanupResult;
import com.cwgsyw.platform.module.authorization.dto.RoleAclConversionResult;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthorizationMigrationExceptionService {
    private final JdbcTemplate jdbcTemplate;
    private final AuthorizationRelationshipCleanupService relationshipCleanupService;
    private final LegacyRoleAclRemediationService roleAclRemediationService;

    public PageResult<AuthorizationMigrationExceptionVO> list(String tenantId, String status, String reasonCode,
                                                               String keyword, int page, int size) {
        int safePage = Math.max(page, 1);
        int safeSize = Math.min(Math.max(size, 1), 200);
        String normalizedStatus = normalizeStatusFilter(status);
        String normalizedReasonCode = reasonCode == null || reasonCode.isBlank() ? null : reasonCode;
        String normalizedKeyword = keyword == null || keyword.isBlank() ? null : "%" + keyword.trim() + "%";
        Long total = jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM authorization_migration_exception e
            LEFT JOIN sys_user u ON u.id = e.user_id AND u.tenant_id = e.tenant_id
            WHERE e.tenant_id = ?
              AND (CAST(? AS VARCHAR) IS NULL OR e.resolution_status = ?)
              AND (CAST(? AS VARCHAR) IS NULL OR e.reason_code = ?)
              AND (CAST(? AS VARCHAR) IS NULL OR u.username ILIKE ? OR u.real_name ILIKE ? OR e.source_key ILIKE ?)
            """, Long.class, tenantId, normalizedStatus, normalizedStatus, normalizedReasonCode, normalizedReasonCode,
            normalizedKeyword, normalizedKeyword, normalizedKeyword, normalizedKeyword);
        List<AuthorizationMigrationExceptionVO> records = jdbcTemplate.query("""
            SELECT e.id, e.run_id, e.tenant_id, e.user_id, u.username, u.real_name,
                   e.source_type, e.source_key, e.reason_code, e.resolution_status,
                   e.resolution_note, e.resolved_by, resolver.real_name AS resolved_by_name,
                   e.resolved_at, e.created_at
            FROM authorization_migration_exception e
            LEFT JOIN sys_user u ON u.id = e.user_id AND u.tenant_id = e.tenant_id
            LEFT JOIN sys_user resolver ON resolver.id = e.resolved_by
            WHERE e.tenant_id = ?
              AND (CAST(? AS VARCHAR) IS NULL OR e.resolution_status = ?)
              AND (CAST(? AS VARCHAR) IS NULL OR e.reason_code = ?)
              AND (CAST(? AS VARCHAR) IS NULL OR u.username ILIKE ? OR u.real_name ILIKE ? OR e.source_key ILIKE ?)
            ORDER BY CASE e.resolution_status WHEN 'open' THEN 0 WHEN 'accepted_legacy' THEN 1 ELSE 2 END,
                     e.created_at DESC, e.id DESC
            LIMIT ? OFFSET ?
            """, (rs, rowNum) -> AuthorizationMigrationExceptionVO.builder()
                .id(rs.getLong("id")).runId(rs.getString("run_id")).tenantId(rs.getString("tenant_id"))
                .userId(nullableLong(rs.getObject("user_id"))).username(rs.getString("username"))
                .realName(rs.getString("real_name")).sourceType(rs.getString("source_type"))
                .sourceKey(rs.getString("source_key")).reasonCode(rs.getString("reason_code"))
                .resolutionStatus(toApiStatus(rs.getString("resolution_status")))
                .resolutionNote(rs.getString("resolution_note"))
                .resolvedBy(nullableLong(rs.getObject("resolved_by")))
                .resolvedByName(rs.getString("resolved_by_name")).resolvedAt(rs.getTimestamp("resolved_at") == null
                    ? null : rs.getTimestamp("resolved_at").toLocalDateTime())
                .createdAt(rs.getTimestamp("created_at").toLocalDateTime()).build(),
            tenantId, normalizedStatus, normalizedStatus, normalizedReasonCode, normalizedReasonCode,
            normalizedKeyword, normalizedKeyword, normalizedKeyword, normalizedKeyword,
            safeSize, (safePage - 1) * safeSize);
        enrichRoleAclDetails(tenantId, records);
        PageResult<AuthorizationMigrationExceptionVO> result = new PageResult<>();
        result.setRecords(records);
        result.setTotal(total == null ? 0 : total);
        result.setPage(safePage);
        result.setSize(safeSize);
        return result;
    }

    @Transactional
    public void resolve(Long exceptionId, String tenantId, String status, String note, Long operatorId) {
        String databaseStatus = toDatabaseStatus(status);
        ExceptionIdentity identity = jdbcTemplate.query("""
            SELECT user_id, source_type, source_key FROM authorization_migration_exception
            WHERE id = ? AND tenant_id = ?
            """, rs -> rs.next() ? new ExceptionIdentity(nullableLong(rs.getObject("user_id")),
                rs.getString("source_type"), rs.getString("source_key")) : null, exceptionId, tenantId);
        if (identity == null) throw new IllegalArgumentException("迁移异常不存在");
        int updated = jdbcTemplate.update("""
            UPDATE authorization_migration_exception
            SET resolution_status = ?, resolution_note = ?, resolved_by = ?, resolved_at = NOW()
            WHERE tenant_id = ? AND source_type = ? AND source_key = ?
              AND resolution_status <> ?
            """, databaseStatus, note.trim(), operatorId, tenantId,
            identity.sourceType(), identity.sourceKey(), databaseStatus);
        if (updated == 0) throw new IllegalStateException("迁移异常状态未发生变化");
        if (identity.userId() != null && "accepted_legacy".equals(databaseStatus)) {
            for (String module : List.of("wiki", "shared_file")) {
                jdbcTemplate.update("""
                    INSERT INTO authorization_account_rollout
                        (tenant_id, user_id, module, migration_state, updated_at)
                    VALUES (?, ?, ?, 'exception', NOW())
                    ON CONFLICT (tenant_id, user_id, module)
                    DO UPDATE SET migration_state = 'exception', updated_at = NOW()
                    """, tenantId, identity.userId(), module);
            }
        }
        jdbcTemplate.update("""
            INSERT INTO audit_log
                (tenant_id, module, action, target_id, target_type, operator_id, remark, created_at)
            VALUES (?, 'authorization', 'migration_exception_resolve', ?, 'migration_exception', ?, ?, NOW())
            """, tenantId, exceptionId, operatorId, databaseStatus + ": " + note.trim());
    }

    @Transactional
    public AuthorizationRelationshipCleanupResult cleanup(Long exceptionId, String tenantId, Long operatorId) {
        CleanupIdentity identity = cleanupIdentity(exceptionId, tenantId);
        if (identity == null) throw new IllegalArgumentException("迁移异常不存在");
        AuthorizationRelationshipCleanupResult cleanup;
        String resolutionNote;
        String auditAction;
        if ("user_role".equals(identity.sourceType()) && "ORPHAN_USER_ROLE".equals(identity.reasonCode())) {
            cleanup = cleanupOrphanUserRole(identity, tenantId, operatorId);
            resolutionNote = "已由系统验证并清理失效的遗留角色关系";
            auditAction = "invalid_relationship_cleanup";
        } else if ("ROLE_ACL_NEEDS_REVIEW".equals(identity.reasonCode())) {
            cleanup = roleAclRemediationService.cleanupEmptyRoleAcl(
                tenantId, identity.sourceType(), identity.sourceKey(), operatorId);
            resolutionNote = "已由系统验证并清理无有效账户命中的遗留角色 ACL";
            auditAction = "empty_role_acl_cleanup";
        } else {
            throw new IllegalArgumentException("该异常不能由系统自动清理");
        }
        return closeAfterCleanup(exceptionId, tenantId, operatorId, identity,
            cleanup, resolutionNote, auditAction);
    }

    @Transactional
    public RoleAclConversionResult convertRoleAcl(Long exceptionId, String tenantId,
                                                  String subjectType, Long subjectId, Long operatorId) {
        CleanupIdentity identity = cleanupIdentity(exceptionId, tenantId);
        if (identity == null) throw new IllegalArgumentException("迁移异常不存在");
        if (!"ROLE_ACL_NEEDS_REVIEW".equals(identity.reasonCode())) {
            throw new IllegalArgumentException("该异常不是待转换的角色 ACL");
        }
        RoleAclConversionResult conversion = roleAclRemediationService.convert(
            tenantId, identity.sourceType(), identity.sourceKey(), subjectType, subjectId, operatorId);
        int resolvedExceptions = resolveSourceExceptions(tenantId, operatorId, identity,
            "遗留角色 ACL 已转换为指定" + ("user".equals(subjectType) ? "用户" : "组"));
        jdbcTemplate.update("""
            INSERT INTO audit_log
                (tenant_id, module, action, target_id, target_type, operator_id, remark, created_at)
            VALUES (?, 'authorization', 'role_acl_convert', ?, 'migration_exception', ?, ?, NOW())
            """, tenantId, exceptionId, operatorId,
            identity.sourceKey() + "; target=" + subjectType + ":" + subjectId
                + "; exceptions=" + resolvedExceptions);
        return conversion.toBuilder().resolvedExceptions(resolvedExceptions).build();
    }

    private AuthorizationRelationshipCleanupResult cleanupOrphanUserRole(
            CleanupIdentity identity, String tenantId, Long operatorId) {
        String[] sourceParts = identity.sourceKey().split(":");
        if (sourceParts.length != 3 || !"sys_user_role".equals(sourceParts[0])) {
            throw new IllegalArgumentException("遗留角色关系来源键无效");
        }
        Long userId;
        Long roleId;
        try {
            userId = Long.valueOf(sourceParts[1]);
            roleId = Long.valueOf(sourceParts[2]);
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("遗留角色关系来源键无效");
        }
        return relationshipCleanupService.cleanupOrphanLegacyRole(tenantId, userId, roleId, operatorId);
    }

    private AuthorizationRelationshipCleanupResult closeAfterCleanup(
            Long exceptionId, String tenantId, Long operatorId, CleanupIdentity identity,
            AuthorizationRelationshipCleanupResult cleanup, String note, String auditAction) {
        int resolvedExceptions = resolveSourceExceptions(tenantId, operatorId, identity, note);
        AuthorizationRelationshipCleanupResult result = cleanup.toBuilder()
            .resolvedExceptions(resolvedExceptions)
            .build();
        jdbcTemplate.update("""
            INSERT INTO audit_log
                (tenant_id, module, action, target_id, target_type, operator_id, remark, created_at)
            VALUES (?, 'authorization', ?, ?, 'migration_exception', ?, ?, NOW())
            """, tenantId, auditAction, exceptionId, operatorId,
            identity.sourceKey() + "; relationships=" + result.getTotalRelationships()
                + "; exceptions=" + resolvedExceptions);
        return result;
    }

    private int resolveSourceExceptions(String tenantId, Long operatorId,
                                        CleanupIdentity identity, String note) {
        return jdbcTemplate.update("""
            UPDATE authorization_migration_exception
            SET resolution_status = 'resolved', resolution_note = ?, resolved_by = ?, resolved_at = NOW()
            WHERE tenant_id = ? AND source_type = ? AND source_key = ?
              AND resolution_status <> 'resolved'
            """, note, operatorId, tenantId,
            identity.sourceType(), identity.sourceKey());
    }

    private CleanupIdentity cleanupIdentity(Long exceptionId, String tenantId) {
        return jdbcTemplate.query("""
            SELECT source_type, source_key, reason_code
            FROM authorization_migration_exception
            WHERE id = ? AND tenant_id = ?
            """, rs -> rs.next() ? new CleanupIdentity(rs.getString("source_type"),
            rs.getString("source_key"), rs.getString("reason_code")) : null, exceptionId, tenantId);
    }

    private void enrichRoleAclDetails(String tenantId, List<AuthorizationMigrationExceptionVO> records) {
        List<LegacyRoleAclRemediationService.SourceReference> references = records.stream()
            .filter(record -> "ROLE_ACL_NEEDS_REVIEW".equals(record.getReasonCode()))
            .map(record -> new LegacyRoleAclRemediationService.SourceReference(
                record.getSourceType(), record.getSourceKey()))
            .toList();
        if (references.isEmpty()) return;
        var detailsBySource = roleAclRemediationService.describeAll(tenantId, references);
        for (AuthorizationMigrationExceptionVO record : records) {
            var details = detailsBySource.get(new LegacyRoleAclRemediationService.SourceReference(
                record.getSourceType(), record.getSourceKey()));
            if (details == null) continue;
            record.setSubjectType(details.subjectType());
            record.setSubjectId(details.subjectId());
            record.setSubjectName(details.subjectName());
            record.setSubjectCode(details.subjectCode());
            record.setActiveSubjectUsers(details.activeSubjectUsers());
            record.setResourceType(details.resourceType());
            record.setResourceId(details.resourceId());
            record.setResourceName(details.resourceName());
            record.setSourcePermissions(details.permissions());
            record.setSourceActive(details.sourceActive());
            record.setResourceActive(details.resourceActive());
            record.setCanSystemCleanup(details.canSystemCleanup());
            record.setCanConvert(details.canConvert());
        }
    }

    private String normalizeStatusFilter(String status) {
        if (status == null || status.isBlank() || "all".equals(status)) return null;
        return toDatabaseStatus(status);
    }

    private String toDatabaseStatus(String status) {
        return switch (status) {
            case "open", "resolved" -> status;
            case "acceptedLegacy", "accepted_legacy" -> "accepted_legacy";
            default -> throw new IllegalArgumentException("不支持的异常处理状态");
        };
    }

    private String toApiStatus(String status) {
        return "accepted_legacy".equals(status) ? "acceptedLegacy" : status;
    }

    private static Long nullableLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private record ExceptionIdentity(Long userId, String sourceType, String sourceKey) {}
    private record CleanupIdentity(String sourceType, String sourceKey, String reasonCode) {}
}
