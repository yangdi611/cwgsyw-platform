package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.config.AuthorizationProperties;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationCutoverStatusVO;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationPermissionDiffVO;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationPermissionSourceVO;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationPreflightIssue;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationPreflightReport;
import com.cwgsyw.platform.module.authorization.dto.PendingAuthorizationUserVO;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.org.GroupMembershipService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthorizationCutoverService {
    private static final List<String> RESOURCE_MODULES = List.of("wiki", "shared_file");

    private final JdbcTemplate jdbcTemplate;
    private final AuthorizationProperties properties;
    private final AuthorizationModeService modeService;
    private final GroupMembershipService groupMembershipService;
    private final AuthorizationWriteLockService authorizationWriteLockService;
    private final ActiveGroupReferenceValidator activeGroupReferenceValidator;

    public AuthorizationCutoverStatusVO status(String tenantId) {
        CutoverRow row = jdbcTemplate.query("""
            SELECT status, cutover_epoch, enforced_at
            FROM authorization_tenant_cutover WHERE tenant_id = ?
            """, rs -> rs.next() ? new CutoverRow(rs.getString("status"), rs.getLong("cutover_epoch"),
                timestamp(rs.getTimestamp("enforced_at"))) : new CutoverRow("preparing", 0L, null), tenantId);
        return AuthorizationCutoverStatusVO.builder()
            .configuredMode(properties.getDecisionMode().name().toLowerCase())
            .effectiveMode(modeService.effectiveMode(tenantId).name().toLowerCase())
            .cutoverStatus(row.status()).cutoverEpoch(row.epoch()).enforcedAt(row.enforcedAt()).build();
    }

    public List<PendingAuthorizationUserVO> pendingUsers(String tenantId) {
        return jdbcTemplate.query("""
            WITH super_admins AS (
                SELECT DISTINCT u.id
                FROM sys_user u
                LEFT JOIN sys_user_role ur ON ur.user_id = u.id
                LEFT JOIN sys_role legacy_role ON legacy_role.id = ur.role_id AND NOT legacy_role.is_deleted
                LEFT JOIN sys_role_assignment a ON a.user_id = u.id AND a.tenant_id = u.tenant_id
                    AND NOT a.is_deleted AND (a.valid_from IS NULL OR a.valid_from <= NOW())
                    AND (a.valid_until IS NULL OR a.valid_until > NOW())
                LEFT JOIN sys_role assigned_role ON assigned_role.id = a.role_id AND NOT assigned_role.is_deleted
                WHERE u.tenant_id = ? AND NOT u.is_deleted
                  AND (legacy_role.code = 'super_admin' OR assigned_role.code = 'super_admin')
            ), primary_memberships AS (
                SELECT m.user_id, m.group_id, g.name AS group_name, g.group_type
                FROM sys_user_group_membership m
                JOIN sys_group g ON g.id = m.group_id AND g.tenant_id = m.tenant_id AND NOT g.is_deleted
                WHERE m.tenant_id = ? AND m.is_primary AND NOT m.is_deleted
            )
            SELECT u.id, u.username, u.real_name, u.status, p.group_id, p.group_name,
                   (p.user_id IS NULL) AS missing_primary,
                   (u.group_id IS DISTINCT FROM p.group_id) AS primary_mismatch,
                   (p.group_type = 'unassigned' AND (
                       EXISTS (
                           SELECT 1 FROM sys_user_role ur
                           JOIN sys_role r ON r.id = ur.role_id AND NOT r.is_deleted
                           WHERE ur.user_id = u.id AND r.scope = 'group'
                       ) OR EXISTS (
                           SELECT 1 FROM sys_role_assignment a
                           WHERE a.tenant_id = u.tenant_id AND a.user_id = u.id
                             AND NOT a.is_deleted AND a.scope_type = 'group'
                             AND (a.valid_from IS NULL OR a.valid_from <= NOW())
                             AND (a.valid_until IS NULL OR a.valid_until > NOW())
                       )
                   )) AS unassigned_group_role
            FROM sys_user u
            LEFT JOIN primary_memberships p ON p.user_id = u.id
            WHERE u.tenant_id = ? AND NOT u.is_deleted
              AND NOT EXISTS (SELECT 1 FROM super_admins s WHERE s.id = u.id)
              AND (p.user_id IS NULL OR u.group_id IS DISTINCT FROM p.group_id
                   OR (p.group_type = 'unassigned' AND (
                       EXISTS (
                           SELECT 1 FROM sys_user_role ur
                           JOIN sys_role r ON r.id = ur.role_id AND NOT r.is_deleted
                           WHERE ur.user_id = u.id AND r.scope = 'group'
                       ) OR EXISTS (
                           SELECT 1 FROM sys_role_assignment a
                           WHERE a.tenant_id = u.tenant_id AND a.user_id = u.id
                             AND NOT a.is_deleted AND a.scope_type = 'group'
                             AND (a.valid_from IS NULL OR a.valid_from <= NOW())
                             AND (a.valid_until IS NULL OR a.valid_until > NOW())
                       )
                   )))
            ORDER BY u.status DESC, u.username
            """, (rs, rowNum) -> {
                List<String> reasons = new ArrayList<>();
                if (rs.getBoolean("missing_primary")) reasons.add("PRIMARY_GROUP_REQUIRED");
                if (rs.getBoolean("primary_mismatch")) reasons.add("PRIMARY_GROUP_MISMATCH");
                if (rs.getBoolean("unassigned_group_role")) reasons.add("UNASSIGNED_GROUP_SCOPE_ROLE");
                return PendingAuthorizationUserVO.builder().userId(rs.getLong("id"))
                    .username(rs.getString("username")).realName(rs.getString("real_name"))
                    .status(rs.getInt("status")).primaryGroupId(nullableLong(rs.getObject("group_id")))
                    .primaryGroupName(rs.getString("group_name")).reasonCodes(reasons).build();
            }, tenantId, tenantId, tenantId);
    }

    @Transactional
    public void assignPrimaryGroup(String tenantId, Long userId, Long groupId, Long operatorId,
                                   String operatorScope) {
        requirePlatformAdministrator(operatorScope);
        lockPrimaryGroupWrites(tenantId, userId, groupId);
        long superAdmins = count("""
            SELECT COUNT(*) FROM sys_user u
            WHERE u.id = ? AND u.tenant_id = ? AND NOT u.is_deleted AND (
                EXISTS (SELECT 1 FROM sys_user_role ur JOIN sys_role r ON r.id = ur.role_id
                        WHERE ur.user_id = u.id AND NOT r.is_deleted AND r.code = 'super_admin')
                OR EXISTS (SELECT 1 FROM sys_role_assignment a JOIN sys_role r ON r.id = a.role_id
                           WHERE a.user_id = u.id AND a.tenant_id = u.tenant_id AND NOT a.is_deleted
                             AND NOT r.is_deleted AND r.code = 'super_admin')
            )
            """, userId, tenantId);
        if (superAdmins > 0) throw new IllegalArgumentException("超级管理员必须保持无组状态");

        String groupType = activeGroupReferenceValidator.lockAndRequire(tenantId, groupId).getGroupType();
        if ("unassigned".equals(groupType)) {
            long businessMemberships = count("""
                SELECT COUNT(*) FROM sys_user_group_membership m
                JOIN sys_group g ON g.id = m.group_id AND g.tenant_id = m.tenant_id
                WHERE m.tenant_id = ? AND m.user_id = ? AND NOT m.is_deleted AND NOT g.is_deleted
                  AND g.group_type = 'business'
                """, tenantId, userId);
            if (businessMemberships > 0) {
                throw new IllegalArgumentException("用户已属于业务组，不能放入未分配组");
            }
            if (hasGroupScopedRole(tenantId, userId)) {
                throw new IllegalArgumentException("用户持有组作用域角色，必须选择真实业务组");
            }
        }

        groupMembershipService.setPrimaryMembership(userId, groupId, tenantId, operatorId);
        if ("business".equals(groupType)) {
            jdbcTemplate.update("""
                UPDATE sys_user_group_membership membership
                SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ?, updated_at = NOW()
                FROM sys_group unassigned_group
                WHERE membership.group_id = unassigned_group.id
                  AND membership.tenant_id = ? AND membership.user_id = ? AND NOT membership.is_deleted
                  AND unassigned_group.tenant_id = membership.tenant_id
                  AND unassigned_group.group_type = 'unassigned' AND NOT unassigned_group.is_deleted
                """, operatorId, tenantId, userId);
        }
        backfillUserRoleAssignments(tenantId, userId, groupId, operatorId);
        jdbcTemplate.update("""
            UPDATE authorization_migration_exception
            SET resolution_status = 'resolved', resolution_note = '已通过待迁移账户入口修正主组',
                resolved_by = ?, resolved_at = NOW()
            WHERE tenant_id = ? AND user_id = ? AND resolution_status <> 'resolved'
              AND reason_code IN ('INVALID_PRIMARY_GROUP', 'GROUP_SCOPE_WITHOUT_GROUP')
            """, operatorId, tenantId, userId);
        jdbcTemplate.update("""
            INSERT INTO audit_log
                (tenant_id, module, action, target_id, target_type, operator_id, remark, created_at)
            VALUES (?, 'authorization', 'migration_primary_group_assign', ?, 'user', ?, ?, NOW())
            """, tenantId, userId, operatorId, "group=" + groupId);
    }

    public AuthorizationPreflightReport preflight(String tenantId) {
        Map<String, Long> counts = new LinkedHashMap<>();
        List<AuthorizationPreflightIssue> issues = new ArrayList<>();

        counts.put("activeUsers", count("SELECT COUNT(*) FROM sys_user WHERE tenant_id = ? AND NOT is_deleted", tenantId));
        List<PendingAuthorizationUserVO> pending = pendingUsers(tenantId);
        counts.put("pendingUsers", (long) pending.size());
        for (PendingAuthorizationUserVO user : pending) {
            issues.add(new AuthorizationPreflightIssue(user.getReasonCodes().getFirst(), user.getUserId(),
                "user:" + user.getUserId(), "用户必须在待迁移账户列表中完成主组处置"));
        }

        addCountIssue(counts, issues, "unresolvedExceptions", "UNRESOLVED_MIGRATION_EXCEPTION",
            count("""
                SELECT COUNT(*) FROM authorization_migration_exception
                WHERE tenant_id = ? AND resolution_status <> 'resolved'
                """, tenantId), "migration_exception", "存在未解决或保留 legacy 的迁移异常");
        addCountIssue(counts, issues, "duplicateLoginIdentities", "DUPLICATE_LOGIN_IDENTITY",
            count("""
                SELECT COUNT(*) FROM (
                    SELECT username FROM sys_user WHERE NOT is_deleted
                    GROUP BY username HAVING COUNT(DISTINCT tenant_id) > 1
                ) duplicates
                """), "login_identity", "同一登录名存在于多个租户，当前登录入口无法消歧");
        addCountIssue(counts, issues, "invalidGroupLeaders", "INVALID_GROUP_LEADER",
            count("""
                SELECT COUNT(*) FROM sys_group g
                LEFT JOIN sys_user u ON u.id = g.leader_id
                WHERE g.tenant_id = ? AND NOT g.is_deleted AND g.leader_id IS NOT NULL
                  AND (u.id IS NULL OR u.is_deleted OR u.tenant_id <> g.tenant_id
                       OR NOT EXISTS (
                           SELECT 1 FROM sys_user_group_membership m
                           WHERE m.tenant_id = g.tenant_id AND m.user_id = g.leader_id
                             AND m.group_id = g.id AND NOT m.is_deleted
                             AND m.membership_role = 'leader'
                       ))
                """, tenantId), "group_leader", "组长无效、跨租户或缺少对应 leader 成员关系");
        addCountIssue(counts, issues, "invalidLegacyUserRoles", "ORPHAN_USER_ROLE",
            count("""
                SELECT COUNT(*) FROM sys_user_role ur
                LEFT JOIN sys_user u ON u.id = ur.user_id
                LEFT JOIN sys_role r ON r.id = ur.role_id
                WHERE (u.id IS NULL OR r.id IS NULL OR u.is_deleted OR r.is_deleted
                       OR u.tenant_id <> r.tenant_id)
                  AND (u.tenant_id = ? OR r.tenant_id = ?)
                """, tenantId, tenantId), "sys_user_role", "旧用户角色关系存在孤儿或跨租户引用");
        addCountIssue(counts, issues, "invalidMemberships", "INVALID_MEMBERSHIP_RELATION",
            count("""
                SELECT COUNT(*) FROM sys_user_group_membership m
                LEFT JOIN sys_user u ON u.id = m.user_id
                LEFT JOIN sys_group g ON g.id = m.group_id
                WHERE m.tenant_id = ? AND NOT m.is_deleted
                  AND (u.id IS NULL OR g.id IS NULL OR u.is_deleted OR g.is_deleted
                       OR u.tenant_id <> m.tenant_id OR g.tenant_id <> m.tenant_id)
                """, tenantId), "membership", "成员关系存在孤儿或跨租户引用");
        addCountIssue(counts, issues, "invalidRoleAssignments", "INVALID_ROLE_ASSIGNMENT",
            count("""
                SELECT COUNT(*) FROM sys_role_assignment a
                LEFT JOIN sys_user u ON u.id = a.user_id
                LEFT JOIN sys_role r ON r.id = a.role_id
                LEFT JOIN sys_group g ON a.scope_type = 'group' AND g.id = a.scope_id
                WHERE a.tenant_id = ? AND NOT a.is_deleted
                  AND (u.id IS NULL OR r.id IS NULL OR u.is_deleted OR r.is_deleted
                       OR u.tenant_id <> a.tenant_id OR r.tenant_id <> a.tenant_id
                       OR a.scope_type = 'project'
                       OR a.scope_type NOT IN ('platform', 'tenant', 'group')
                       OR (a.scope_type IN ('platform', 'tenant') AND a.scope_id IS NOT NULL)
                       OR (a.scope_type = 'group' AND (
                           a.scope_id IS NULL OR g.id IS NULL OR g.is_deleted
                           OR g.tenant_id <> a.tenant_id OR g.group_type = 'unassigned'
                           OR NOT EXISTS (
                               SELECT 1 FROM sys_user_group_membership m
                               WHERE m.tenant_id = a.tenant_id AND m.user_id = a.user_id
                                 AND m.group_id = a.scope_id AND NOT m.is_deleted
                           )
                       )))
                """, tenantId), "role_assignment", "角色分配存在孤儿、跨租户或无效作用域");
        addCountIssue(counts, issues, "legacyScopeMismatches", "LEGACY_SCOPE_MISMATCH",
            count("""
                SELECT COUNT(*) FROM sys_user_role ur
                JOIN sys_user u ON u.id = ur.user_id AND NOT u.is_deleted
                JOIN sys_role r ON r.id = ur.role_id AND NOT r.is_deleted
                WHERE u.tenant_id = ? AND r.tenant_id = u.tenant_id
                  AND NOT EXISTS (
                      SELECT 1 FROM sys_role_assignment a
                      WHERE a.tenant_id = u.tenant_id AND a.user_id = ur.user_id
                        AND a.role_id = ur.role_id AND NOT a.is_deleted
                        AND a.scope_type = r.scope
                        AND ((r.scope IN ('platform', 'tenant') AND a.scope_id IS NULL)
                             OR (r.scope = 'group' AND a.scope_id = u.group_id))
                        AND (a.valid_from IS NULL OR a.valid_from <= NOW())
                        AND (a.valid_until IS NULL OR a.valid_until > NOW())
                  )
                """, tenantId), "legacy_role_scope", "旧用户角色没有等价的有效作用域 assignment");
        addCountIssue(counts, issues, "invalidUnassignedMemberships", "INVALID_UNASSIGNED_MEMBERSHIP",
            count("""
                SELECT COUNT(*) FROM sys_user_group_membership m
                JOIN sys_group g ON g.id = m.group_id AND g.tenant_id = m.tenant_id
                WHERE m.tenant_id = ? AND NOT m.is_deleted AND NOT g.is_deleted
                  AND g.group_type = 'unassigned'
                  AND (NOT m.is_primary OR m.membership_role <> 'member'
                       OR EXISTS (
                           SELECT 1 FROM sys_user_group_membership business_m
                           JOIN sys_group business_g ON business_g.id = business_m.group_id
                             AND business_g.tenant_id = business_m.tenant_id
                           WHERE business_m.tenant_id = m.tenant_id
                             AND business_m.user_id = m.user_id AND NOT business_m.is_deleted
                             AND NOT business_g.is_deleted AND business_g.group_type = 'business'
                       )
                       OR EXISTS (
                           SELECT 1 FROM sys_role_assignment a
                           WHERE a.tenant_id = m.tenant_id AND a.user_id = m.user_id
                             AND NOT a.is_deleted AND a.scope_type = 'group'
                             AND (a.valid_from IS NULL OR a.valid_from <= NOW())
                             AND (a.valid_until IS NULL OR a.valid_until > NOW())
                       ))
                """, tenantId), "unassigned_group", "未分配组成员必须是无业务组、无组作用域角色的普通主组成员");
        addCountIssue(counts, issues, "groupedSuperAdmins", "SUPER_ADMIN_MUST_BE_GROUPLESS",
            count("""
                SELECT COUNT(DISTINCT u.id) FROM sys_user u
                WHERE u.tenant_id = ? AND NOT u.is_deleted
                  AND (EXISTS (
                      SELECT 1 FROM sys_user_role ur
                      JOIN sys_role legacy_role ON legacy_role.id = ur.role_id
                      WHERE ur.user_id = u.id AND NOT legacy_role.is_deleted
                        AND legacy_role.code = 'super_admin'
                  ) OR EXISTS (
                      SELECT 1 FROM sys_role_assignment a
                      JOIN sys_role assigned_role ON assigned_role.id = a.role_id
                      WHERE a.user_id = u.id AND a.tenant_id = u.tenant_id AND NOT a.is_deleted
                        AND NOT assigned_role.is_deleted AND assigned_role.code = 'super_admin'
                  ))
                  AND (u.group_id IS NOT NULL OR EXISTS (
                      SELECT 1 FROM sys_user_group_membership m
                      WHERE m.tenant_id = u.tenant_id AND m.user_id = u.id AND NOT m.is_deleted
                  ))
                """, tenantId), "super_admin", "超级管理员必须保持无组状态");
        addCountIssue(counts, issues, "invalidResourceParents", "INVALID_RESOURCE_PARENT",
            count("""
                SELECT COUNT(*) FROM (
                    SELECT page.id FROM wiki_page page
                    LEFT JOIN wiki_space space ON space.id = page.space_id
                        AND space.tenant_id = page.tenant_id AND NOT space.is_deleted
                    LEFT JOIN wiki_page parent ON parent.id = page.parent_id
                        AND parent.tenant_id = page.tenant_id AND NOT parent.is_deleted
                    WHERE page.tenant_id = ? AND NOT page.is_deleted
                      AND (space.id IS NULL OR (page.parent_id IS NOT NULL
                           AND (parent.id IS NULL OR parent.space_id <> page.space_id)))
                    UNION ALL
                    SELECT folder.id FROM shared_folder folder
                    LEFT JOIN shared_folder parent ON parent.id = folder.parent_id
                        AND parent.tenant_id = folder.tenant_id AND NOT parent.is_deleted
                    WHERE folder.tenant_id = ? AND NOT folder.is_deleted
                      AND folder.parent_id IS NOT NULL AND parent.id IS NULL
                    UNION ALL
                    SELECT file.id FROM shared_file file
                    LEFT JOIN shared_folder parent ON parent.id = file.folder_id
                        AND parent.tenant_id = file.tenant_id AND NOT parent.is_deleted
                    WHERE file.tenant_id = ? AND NOT file.is_deleted
                      AND file.folder_id IS NOT NULL AND parent.id IS NULL
                ) invalid_parents
                """, tenantId, tenantId, tenantId), "resource_parent", "资源父链存在孤儿或跨空间关系");
        addCountIssue(counts, issues, "invalidResourceAcls", "INVALID_RESOURCE_ACL",
            count("""
                SELECT COUNT(*) FROM resource_acl_entry acl
                LEFT JOIN sys_user subject_user ON acl.subject_type = 'user'
                    AND subject_user.id = acl.subject_id AND subject_user.tenant_id = acl.tenant_id
                    AND NOT subject_user.is_deleted
                LEFT JOIN sys_group subject_group ON acl.subject_type = 'group'
                    AND subject_group.id = acl.subject_id AND subject_group.tenant_id = acl.tenant_id
                    AND NOT subject_group.is_deleted
                WHERE acl.tenant_id = ? AND NOT acl.is_deleted
                  AND ((acl.subject_type = 'user' AND subject_user.id IS NULL)
                       OR (acl.subject_type = 'group' AND (
                           subject_group.id IS NULL OR subject_group.group_type = 'unassigned'
                       )))
                """, tenantId), "resource_acl", "资源 ACL 主体不存在、跨租户或指向未分配组");
        addCountIssue(counts, issues, "permissionDiffUsers", "FUNCTION_PERMISSION_DIFF",
            count(permissionDiffSql(), tenantId, tenantId), "functional_permissions",
            "旧角色与新 assignment 的有效功能权限不一致");
        List<AuthorizationPermissionDiffVO> permissionDiffs = permissionDiffDetails(tenantId);
        addCountIssue(counts, issues, "incompleteResources", "RESOURCE_NOT_MIGRATED",
            count("""
                SELECT COUNT(*) FROM (
                    SELECT id FROM wiki_space WHERE tenant_id = ? AND NOT is_deleted
                        AND (owner_user_id IS NULL OR owner_group_id IS NULL OR permission_mode IS NULL)
                    UNION ALL SELECT id FROM wiki_page WHERE tenant_id = ? AND NOT is_deleted
                        AND (owner_user_id IS NULL OR owner_group_id IS NULL OR permission_mode IS NULL)
                    UNION ALL SELECT id FROM shared_folder WHERE tenant_id = ? AND NOT is_deleted
                        AND (owner_user_id IS NULL OR owner_group_id IS NULL OR permission_mode IS NULL)
                    UNION ALL SELECT id FROM shared_file WHERE tenant_id = ? AND NOT is_deleted
                        AND (owner_user_id IS NULL OR owner_group_id IS NULL OR permission_mode IS NULL)
                ) resources
                """, tenantId, tenantId, tenantId, tenantId), "resources",
            "Wiki 或共享文档仍有资源缺少 owner/group/mode");
        addCountIssue(counts, issues, "invalidResourceOwners", "INVALID_RESOURCE_OWNER",
            invalidResourceOwnerCount(tenantId), "resource_owner",
            "资源 owner 或 owning group 无效、跨租户或指向未分配组");
        addCountIssue(counts, issues, "legacyRoleAcls", "ROLE_ACL_NEEDS_REVIEW",
            count("""
                SELECT COUNT(*) FROM (
                    SELECT id FROM wiki_space_acl WHERE tenant_id = ? AND NOT is_deleted AND subject_type = 'role'
                    UNION ALL SELECT id FROM wiki_page_acl WHERE tenant_id = ? AND NOT is_deleted AND subject_type = 'role'
                    UNION ALL SELECT id FROM shared_folder_acl WHERE tenant_id = ? AND NOT is_deleted AND subject_type = 'role'
                ) role_acls
                """, tenantId, tenantId, tenantId), "role_acl",
            "旧 role ACL 必须手工转换为 user/group ACL");
        addCountIssue(counts, issues, "latestDecisionDiffs", "SHADOW_DECISION_DIFF",
            count(activeResourceDecisionDiffSql(), tenantId), "decision_diff", "Shadow 最新判定仍存在差异");
        addCountIssue(counts, issues, "unobservedPermissionGrants", "SHADOW_COVERAGE_INCOMPLETE",
            count(unobservedPermissionSql(), tenantId, tenantId), "shadow_coverage",
            "存在尚未经过 Shadow 观测的 Wiki/共享文档授权");
        long newSuperAdmins = count("""
            SELECT COUNT(DISTINCT a.user_id)
            FROM sys_role_assignment a
            JOIN sys_user u ON u.id = a.user_id AND u.tenant_id = a.tenant_id
            JOIN sys_role r ON r.id = a.role_id
            WHERE a.tenant_id = ? AND NOT a.is_deleted AND NOT u.is_deleted AND u.status = 1
              AND NOT r.is_deleted AND r.code = 'super_admin' AND a.scope_type = 'platform'
              AND (a.valid_from IS NULL OR a.valid_from <= NOW())
              AND (a.valid_until IS NULL OR a.valid_until > NOW())
            """, tenantId);
        counts.put("activeNewSuperAdmins", newSuperAdmins);
        if (newSuperAdmins == 0) {
            issues.add(new AuthorizationPreflightIssue("NO_ACTIVE_NEW_SUPER_ADMIN", null, "super_admin",
                "新授权模型中没有有效的 platform super_admin assignment"));
        }
        counts.put("rolloutRows", count("""
            SELECT COUNT(*) FROM authorization_account_rollout r
            JOIN sys_user u ON u.id = r.user_id AND u.tenant_id = r.tenant_id
            WHERE r.tenant_id = ? AND NOT u.is_deleted AND r.module IN ('wiki', 'shared_file')
            """, tenantId));

        return AuthorizationPreflightReport.builder().eligible(issues.isEmpty()).counts(counts).issues(issues)
            .permissionDiffs(permissionDiffs).build();
    }

    @Transactional
    public AuthorizationCutoverStatusVO enforce(String tenantId, Long operatorId, String operatorScope,
                                                String confirmation) {
        requirePlatformAdministrator(operatorScope);
        if (!"ENFORCE".equals(confirmation)) throw new IllegalArgumentException("请输入 ENFORCE 确认切换");
        if (properties.getDecisionMode() != AuthorizationProperties.DecisionMode.ENFORCED) {
            throw new IllegalStateException("应用未以 AUTHORIZATION_DECISION_MODE=ENFORCED 启动");
        }
        String currentStatus = jdbcTemplate.query("""
            SELECT status FROM authorization_tenant_cutover
            WHERE tenant_id = ? FOR UPDATE
            """, rs -> rs.next() ? rs.getString("status") : "preparing", tenantId);
        if ("enforced".equals(currentStatus)) {
            throw new IllegalStateException("当前已处于 Enforced 状态，无需重复切换");
        }

        lockAuthorizationSources();
        AuthorizationPreflightReport report = preflight(tenantId);
        if (!report.isEligible()) {
            throw new IllegalStateException("严格切换门禁未通过，已取消 Enforced 切换");
        }
        for (String module : RESOURCE_MODULES) {
            jdbcTemplate.update("""
                INSERT INTO authorization_account_rollout
                    (tenant_id, user_id, module, migration_state, last_reconciled_at, updated_at)
                SELECT u.tenant_id, u.id, ?, 'enforced', NOW(), NOW()
                FROM sys_user u WHERE u.tenant_id = ? AND NOT u.is_deleted
                ON CONFLICT (tenant_id, user_id, module)
                DO UPDATE SET migration_state = 'enforced', last_reconciled_at = NOW(), updated_at = NOW()
                """, module, tenantId);
        }
        jdbcTemplate.update("""
            INSERT INTO authorization_tenant_cutover
                (tenant_id, status, cutover_epoch, last_preflight_at, enforced_at, updated_at, updated_by)
            VALUES (?, 'enforced', 1, NOW(), NOW(), NOW(), ?)
            ON CONFLICT (tenant_id) DO UPDATE
            SET status = 'enforced', cutover_epoch = authorization_tenant_cutover.cutover_epoch + 1,
                last_preflight_at = NOW(), enforced_at = NOW(), updated_at = NOW(), updated_by = EXCLUDED.updated_by
            """, tenantId, operatorId);
        audit(tenantId, operatorId, "strict_cutover_enforced");
        return status(tenantId);
    }

    @Transactional
    public AuthorizationCutoverStatusVO rollback(String tenantId, Long operatorId, String operatorScope,
                                                 String confirmation) {
        requirePlatformAdministrator(operatorScope);
        if (!"ROLLBACK".equals(confirmation)) throw new IllegalArgumentException("请输入 ROLLBACK 确认回退");
        String currentStatus = jdbcTemplate.query("""
            SELECT status FROM authorization_tenant_cutover
            WHERE tenant_id = ? FOR UPDATE
            """, rs -> rs.next() ? rs.getString("status") : "preparing", tenantId);
        if ("rollback".equals(currentStatus)) {
            throw new IllegalStateException("当前已处于 Rollback 状态，无需重复回退");
        }
        jdbcTemplate.update("""
            INSERT INTO authorization_tenant_cutover (tenant_id, status, updated_at, updated_by)
            VALUES (?, 'rollback', NOW(), ?)
            ON CONFLICT (tenant_id) DO UPDATE
            SET status = 'rollback', updated_at = NOW(), updated_by = EXCLUDED.updated_by
            """, tenantId, operatorId);
        jdbcTemplate.update("""
            UPDATE authorization_account_rollout SET migration_state = 'legacy', updated_at = NOW()
            WHERE tenant_id = ?
            """, tenantId);
        audit(tenantId, operatorId, "strict_cutover_rollback");
        return status(tenantId);
    }

    private void backfillUserRoleAssignments(String tenantId, Long userId, Long primaryGroupId, Long operatorId) {
        jdbcTemplate.update("""
            UPDATE sys_role_assignment
            SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ?, updated_at = NOW()
            WHERE tenant_id = ? AND user_id = ? AND scope_type = 'group' AND NOT is_deleted
              AND origin_type IN ('migration', 'compatibility')
              AND scope_id IS DISTINCT FROM ?
            """, operatorId, tenantId, userId, primaryGroupId);
        jdbcTemplate.update("""
            INSERT INTO sys_role_assignment
                (tenant_id, user_id, role_id, scope_type, scope_id, origin_type, origin_key,
                 created_by, created_at, updated_at)
            SELECT u.tenant_id, ur.user_id, ur.role_id, r.scope,
                   CASE WHEN r.scope = 'group' THEN ? ELSE NULL END,
                   'compatibility', 'sys_user_role:' || ur.user_id || ':' || ur.role_id,
                   ?, NOW(), NOW()
            FROM sys_user_role ur
            JOIN sys_user u ON u.id = ur.user_id AND NOT u.is_deleted
            JOIN sys_role r ON r.id = ur.role_id AND r.tenant_id = u.tenant_id AND NOT r.is_deleted
            WHERE u.tenant_id = ? AND u.id = ? AND r.scope IN ('platform', 'tenant', 'group')
              AND (r.scope <> 'group' OR EXISTS (
                  SELECT 1 FROM sys_group scope_group
                  WHERE scope_group.id = ? AND scope_group.tenant_id = u.tenant_id
                    AND NOT scope_group.is_deleted AND scope_group.group_type = 'business'
              ))
            ON CONFLICT (tenant_id, user_id, role_id, scope_type, (COALESCE(scope_id, 0)))
                WHERE NOT is_deleted
            DO UPDATE SET updated_at = NOW()
            """, primaryGroupId, operatorId, tenantId, userId, primaryGroupId);
        for (String module : RESOURCE_MODULES) {
            jdbcTemplate.update("""
                INSERT INTO authorization_account_rollout
                    (tenant_id, user_id, module, migration_state, updated_at)
                VALUES (?, ?, ?, 'shadow', NOW())
                ON CONFLICT (tenant_id, user_id, module)
                DO UPDATE SET migration_state = CASE
                    WHEN authorization_account_rollout.migration_state = 'enforced' THEN 'enforced'
                    ELSE 'shadow' END, updated_at = NOW()
                """, tenantId, userId, module);
        }
    }

    private void lockPrimaryGroupWrites(String tenantId, Long userId, Long targetGroupId) {
        authorizationWriteLockService.lockUserAuthorization(tenantId, userId);
        jdbcTemplate.queryForList("""
            SELECT role_id FROM (
                SELECT ur.role_id
                FROM sys_user_role ur
                JOIN sys_user u ON u.id = ur.user_id
                JOIN sys_role r ON r.id = ur.role_id
                WHERE u.tenant_id = ? AND u.id = ? AND r.tenant_id = u.tenant_id
                UNION
                SELECT a.role_id
                FROM sys_role_assignment a
                JOIN sys_role r ON r.id = a.role_id AND r.tenant_id = a.tenant_id
                WHERE a.tenant_id = ? AND a.user_id = ? AND NOT a.is_deleted
            ) affected_roles
            """, Long.class, tenantId, userId, tenantId, userId).stream()
            .distinct().sorted()
            .forEach(roleId -> authorizationWriteLockService.lockRoleAuthorization(tenantId, roleId));
        List<Long> groupIds = new ArrayList<>(jdbcTemplate.queryForList("""
            SELECT group_id FROM (
                SELECT m.group_id
                FROM sys_user_group_membership m
                WHERE m.tenant_id = ? AND m.user_id = ? AND NOT m.is_deleted
                UNION
                SELECT a.scope_id AS group_id
                FROM sys_role_assignment a
                WHERE a.tenant_id = ? AND a.user_id = ? AND NOT a.is_deleted
                  AND a.scope_type = 'group' AND a.scope_id IS NOT NULL
            ) active_group_writes
            """, Long.class, tenantId, userId, tenantId, userId));
        groupIds.add(targetGroupId);
        groupIds.stream().filter(java.util.Objects::nonNull).distinct()
            .sorted(Comparator.naturalOrder())
            .forEach(groupId -> authorizationWriteLockService.lockGroupAssignment(
                tenantId, userId, groupId));
    }

    private boolean hasGroupScopedRole(String tenantId, Long userId) {
        return count("""
            SELECT COUNT(*) FROM (
                SELECT ur.role_id FROM sys_user_role ur
                JOIN sys_role r ON r.id = ur.role_id
                JOIN sys_user u ON u.id = ur.user_id
                WHERE u.tenant_id = ? AND ur.user_id = ? AND NOT r.is_deleted AND r.scope = 'group'
                UNION ALL
                SELECT a.role_id FROM sys_role_assignment a
                WHERE a.tenant_id = ? AND a.user_id = ? AND NOT a.is_deleted AND a.scope_type = 'group'
            ) group_roles
            """, tenantId, userId, tenantId, userId) > 0;
    }

    private long invalidResourceOwnerCount(String tenantId) {
        return count("""
            SELECT COUNT(*) FROM (
                SELECT resource.id FROM wiki_space resource
                LEFT JOIN sys_user owner_user ON owner_user.id = resource.owner_user_id
                    AND owner_user.tenant_id = resource.tenant_id AND NOT owner_user.is_deleted
                LEFT JOIN sys_group owner_group ON owner_group.id = resource.owner_group_id
                    AND owner_group.tenant_id = resource.tenant_id AND NOT owner_group.is_deleted
                WHERE resource.tenant_id = ? AND NOT resource.is_deleted
                  AND (owner_user.id IS NULL OR owner_group.id IS NULL OR owner_group.group_type = 'unassigned')
                UNION ALL
                SELECT resource.id FROM wiki_page resource
                LEFT JOIN sys_user owner_user ON owner_user.id = resource.owner_user_id
                    AND owner_user.tenant_id = resource.tenant_id AND NOT owner_user.is_deleted
                LEFT JOIN sys_group owner_group ON owner_group.id = resource.owner_group_id
                    AND owner_group.tenant_id = resource.tenant_id AND NOT owner_group.is_deleted
                WHERE resource.tenant_id = ? AND NOT resource.is_deleted
                  AND (owner_user.id IS NULL OR owner_group.id IS NULL OR owner_group.group_type = 'unassigned')
                UNION ALL
                SELECT resource.id FROM shared_folder resource
                LEFT JOIN sys_user owner_user ON owner_user.id = resource.owner_user_id
                    AND owner_user.tenant_id = resource.tenant_id AND NOT owner_user.is_deleted
                LEFT JOIN sys_group owner_group ON owner_group.id = resource.owner_group_id
                    AND owner_group.tenant_id = resource.tenant_id AND NOT owner_group.is_deleted
                WHERE resource.tenant_id = ? AND NOT resource.is_deleted
                  AND (owner_user.id IS NULL OR owner_group.id IS NULL OR owner_group.group_type = 'unassigned')
                UNION ALL
                SELECT resource.id FROM shared_file resource
                LEFT JOIN sys_user owner_user ON owner_user.id = resource.owner_user_id
                    AND owner_user.tenant_id = resource.tenant_id AND NOT owner_user.is_deleted
                LEFT JOIN sys_group owner_group ON owner_group.id = resource.owner_group_id
                    AND owner_group.tenant_id = resource.tenant_id AND NOT owner_group.is_deleted
                WHERE resource.tenant_id = ? AND NOT resource.is_deleted
                  AND (owner_user.id IS NULL OR owner_group.id IS NULL OR owner_group.group_type = 'unassigned')
            ) invalid
            """, tenantId, tenantId, tenantId, tenantId);
    }

    private String permissionDiffSql() {
        return """
            WITH legacy_permissions AS (
                SELECT DISTINCT ur.user_id, p.code
                FROM sys_user_role ur
                JOIN sys_user u ON u.id = ur.user_id AND NOT u.is_deleted
                JOIN sys_role r ON r.id = ur.role_id AND NOT r.is_deleted
                JOIN sys_role_permission rp ON rp.role_id = r.id
                JOIN sys_permission p ON p.id = rp.permission_id
                WHERE u.tenant_id = ?
            ), assignment_permissions AS (
                SELECT DISTINCT a.user_id, p.code
                FROM sys_role_assignment a
                JOIN sys_user u ON u.id = a.user_id AND NOT u.is_deleted
                JOIN sys_role r ON r.id = a.role_id AND NOT r.is_deleted
                JOIN sys_role_permission rp ON rp.role_id = r.id
                JOIN sys_permission p ON p.id = rp.permission_id
                WHERE a.tenant_id = ? AND NOT a.is_deleted
                  AND (a.valid_from IS NULL OR a.valid_from <= NOW())
                  AND (a.valid_until IS NULL OR a.valid_until > NOW())
            ), differences AS (
                SELECT COALESCE(l.user_id, a.user_id) AS user_id
                FROM legacy_permissions l FULL JOIN assignment_permissions a
                  ON a.user_id = l.user_id AND a.code = l.code
                WHERE l.code IS NULL OR a.code IS NULL
            ) SELECT COUNT(DISTINCT user_id) FROM differences
            """;
    }

    List<AuthorizationPermissionDiffVO> permissionDiffDetails(String tenantId) {
        Map<String, AuthorizationPermissionDiffVO> details = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbcTemplate.queryForList(
                permissionDiffDetailSql(), tenantId, tenantId)) {
            Long userId = nullableLong(row.get("user_id"));
            String permissionCode = stringValue(row.get("permission_code"));
            String key = userId + "\u0000" + permissionCode;
            AuthorizationPermissionDiffVO detail = details.computeIfAbsent(key,
                ignored -> AuthorizationPermissionDiffVO.builder()
                    .userId(userId)
                    .username(stringValue(row.get("username")))
                    .realName(stringValue(row.get("real_name")))
                    .permissionCode(permissionCode)
                    .permissionName(stringValue(row.get("permission_name")))
                    .legacyAllowed(booleanValue(row.get("legacy_allowed")))
                    .assignmentAllowed(booleanValue(row.get("assignment_allowed")))
                    .legacySources(new ArrayList<>())
                    .assignmentSources(new ArrayList<>())
                    .build());
            String sourceModel = stringValue(row.get("source_model"));
            if (sourceModel == null) continue;
            AuthorizationPermissionSourceVO source = AuthorizationPermissionSourceVO.builder()
                .roleId(nullableLong(row.get("role_id")))
                .roleCode(stringValue(row.get("role_code")))
                .roleName(stringValue(row.get("role_name")))
                .assignmentId(nullableLong(row.get("assignment_id")))
                .scopeType(stringValue(row.get("scope_type")))
                .scopeId(nullableLong(row.get("scope_id")))
                .scopeName(stringValue(row.get("scope_name")))
                .originType(stringValue(row.get("origin_type")))
                .build();
            if ("legacy".equals(sourceModel)) detail.getLegacySources().add(source);
            if ("assignment".equals(sourceModel)) detail.getAssignmentSources().add(source);
        }
        return new ArrayList<>(details.values());
    }

    private String permissionDiffDetailSql() {
        return """
            WITH legacy_sources AS (
                SELECT DISTINCT u.tenant_id, ur.user_id, p.code AS permission_code,
                    p.name AS permission_name, r.id AS role_id, r.code AS role_code,
                    r.name AS role_name
                FROM sys_user_role ur
                JOIN sys_user u ON u.id = ur.user_id AND NOT u.is_deleted
                JOIN sys_role r ON r.id = ur.role_id AND NOT r.is_deleted
                JOIN sys_role_permission rp ON rp.role_id = r.id
                JOIN sys_permission p ON p.id = rp.permission_id
                WHERE u.tenant_id = ?
            ), assignment_sources AS (
                SELECT DISTINCT a.tenant_id, a.user_id, p.code AS permission_code,
                    p.name AS permission_name, r.id AS role_id, r.code AS role_code,
                    r.name AS role_name, a.id AS assignment_id, a.scope_type, a.scope_id,
                    CASE
                        WHEN a.scope_type = 'platform' THEN '平台'
                        WHEN a.scope_type = 'tenant' THEN '当前租户'
                        WHEN a.scope_type = 'group' THEN g.name
                        ELSE a.scope_type
                    END AS scope_name,
                    a.origin_type
                FROM sys_role_assignment a
                JOIN sys_user u ON u.id = a.user_id AND NOT u.is_deleted
                JOIN sys_role r ON r.id = a.role_id AND NOT r.is_deleted
                JOIN sys_role_permission rp ON rp.role_id = r.id
                JOIN sys_permission p ON p.id = rp.permission_id
                LEFT JOIN sys_group g ON a.scope_type = 'group' AND g.id = a.scope_id
                    AND g.tenant_id = a.tenant_id AND NOT g.is_deleted
                WHERE a.tenant_id = ? AND NOT a.is_deleted
                  AND (a.valid_from IS NULL OR a.valid_from <= NOW())
                  AND (a.valid_until IS NULL OR a.valid_until > NOW())
            ), legacy_permissions AS (
                SELECT DISTINCT tenant_id, user_id, permission_code, permission_name
                FROM legacy_sources
            ), assignment_permissions AS (
                SELECT DISTINCT tenant_id, user_id, permission_code, permission_name
                FROM assignment_sources
            ), differences AS (
                SELECT COALESCE(l.tenant_id, a.tenant_id) AS tenant_id,
                    COALESCE(l.user_id, a.user_id) AS user_id,
                    COALESCE(l.permission_code, a.permission_code) AS permission_code,
                    COALESCE(l.permission_name, a.permission_name) AS permission_name,
                    l.permission_code IS NOT NULL AS legacy_allowed,
                    a.permission_code IS NOT NULL AS assignment_allowed
                FROM legacy_permissions l FULL JOIN assignment_permissions a
                  ON a.tenant_id = l.tenant_id AND a.user_id = l.user_id
                 AND a.permission_code = l.permission_code
                WHERE l.permission_code IS NULL OR a.permission_code IS NULL
            ), sources AS (
                SELECT tenant_id, user_id, permission_code, 'legacy' AS source_model,
                    role_id, role_code, role_name, NULL::BIGINT AS assignment_id,
                    NULL::VARCHAR AS scope_type, NULL::BIGINT AS scope_id,
                    NULL::VARCHAR AS scope_name, NULL::VARCHAR AS origin_type
                FROM legacy_sources
                UNION ALL
                SELECT tenant_id, user_id, permission_code, 'assignment' AS source_model,
                    role_id, role_code, role_name, assignment_id, scope_type, scope_id,
                    scope_name, origin_type
                FROM assignment_sources
            )
            SELECT d.user_id, u.username, u.real_name, d.permission_code, d.permission_name,
                d.legacy_allowed, d.assignment_allowed, source.source_model,
                source.role_id, source.role_code, source.role_name, source.assignment_id,
                source.scope_type, source.scope_id, source.scope_name, source.origin_type
            FROM differences d
            JOIN sys_user u ON u.id = d.user_id AND u.tenant_id = d.tenant_id
            LEFT JOIN sources source ON source.tenant_id = d.tenant_id
                AND source.user_id = d.user_id AND source.permission_code = d.permission_code
            ORDER BY u.username, d.permission_code, source.source_model, source.role_name,
                source.assignment_id
            """;
    }

    String activeResourceDecisionDiffSql() {
        return """
            SELECT COUNT(*) FROM (
                SELECT DISTINCT ON (diff.user_id, diff.module, diff.permission_code,
                                    diff.resource_type, diff.resource_id)
                    diff.legacy_allowed, diff.new_allowed
                FROM authorization_decision_diff diff
                JOIN sys_user u ON u.id = diff.user_id AND u.tenant_id = diff.tenant_id
                    AND NOT u.is_deleted AND u.status = 1
                WHERE diff.tenant_id = ?
                  AND NOT (
                      diff.module = 'wiki'
                      AND diff.permission_code IN ('wiki:create', 'wiki:update', 'wiki:delete',
                                                   'wiki:publish', 'wiki:manage_acl')
                      AND (
                          (diff.resource_type = 'wiki_space' AND EXISTS (
                              SELECT 1 FROM wiki_space space
                              WHERE space.id = diff.resource_id AND space.tenant_id = diff.tenant_id
                                AND NOT space.is_deleted AND space.seed_key IS NOT NULL
                                AND space.write_scope <> 'all'
                          ))
                          OR (diff.resource_type = 'wiki_page' AND EXISTS (
                              SELECT 1 FROM wiki_page page
                              JOIN wiki_space space ON space.id = page.space_id
                                AND space.tenant_id = page.tenant_id
                              WHERE page.id = diff.resource_id AND page.tenant_id = diff.tenant_id
                                AND NOT page.is_deleted AND NOT space.is_deleted
                                AND space.seed_key IS NOT NULL AND space.write_scope <> 'all'
                          ))
                      )
                  )
                  AND (
                      (diff.resource_type = 'wiki_space' AND EXISTS (
                          SELECT 1 FROM wiki_space resource
                          WHERE resource.id = diff.resource_id AND resource.tenant_id = diff.tenant_id
                            AND NOT resource.is_deleted
                      ))
                      OR (diff.resource_type = 'wiki_page' AND EXISTS (
                          SELECT 1 FROM wiki_page resource
                          WHERE resource.id = diff.resource_id AND resource.tenant_id = diff.tenant_id
                            AND NOT resource.is_deleted
                      ))
                      OR (diff.resource_type = 'shared_folder' AND EXISTS (
                          SELECT 1 FROM shared_folder resource
                          WHERE resource.id = diff.resource_id AND resource.tenant_id = diff.tenant_id
                            AND NOT resource.is_deleted
                      ))
                      OR (diff.resource_type = 'shared_file' AND EXISTS (
                          SELECT 1 FROM shared_file resource
                          WHERE resource.id = diff.resource_id AND resource.tenant_id = diff.tenant_id
                            AND NOT resource.is_deleted
                      ))
                  )
                ORDER BY diff.user_id, diff.module, diff.permission_code,
                         diff.resource_type, diff.resource_id, diff.observed_at DESC, diff.id DESC
            ) latest WHERE legacy_allowed <> new_allowed
            """;
    }

    private String unobservedPermissionSql() {
        return """
            WITH legacy_grants AS (
                SELECT DISTINCT u.id AS user_id, p.code,
                    CASE WHEN p.code LIKE 'wiki:%' THEN 'wiki' ELSE 'shared_file' END AS module
                FROM sys_user u
                JOIN sys_user_role ur ON ur.user_id = u.id
                JOIN sys_role r ON r.id = ur.role_id AND NOT r.is_deleted
                JOIN sys_role_permission rp ON rp.role_id = r.id
                JOIN sys_permission p ON p.id = rp.permission_id
                WHERE u.tenant_id = ? AND NOT u.is_deleted
                  AND (p.code LIKE 'wiki:%' OR p.code LIKE 'shared_file:%')
                  AND p.code <> 'shared_file:update'
            )
            SELECT COUNT(*) FROM legacy_grants grant_row
            WHERE NOT EXISTS (
                SELECT 1 FROM authorization_decision_diff d
                WHERE d.tenant_id = ? AND d.user_id = grant_row.user_id
                  AND d.module = grant_row.module AND d.permission_code = grant_row.code
            )
            """;
    }

    private void lockAuthorizationSources() {
        jdbcTemplate.execute("""
            LOCK TABLE sys_user, sys_group, sys_user_role, sys_role, sys_role_permission,
                sys_user_group_membership, sys_role_assignment, wiki_space, wiki_page,
                wiki_space_acl, wiki_page_acl, shared_folder, shared_file, shared_folder_acl,
                resource_acl_entry IN SHARE MODE
            """);
    }

    private void addCountIssue(Map<String, Long> counts, List<AuthorizationPreflightIssue> issues,
                               String countKey, String reasonCode, long value,
                               String sourceKey, String message) {
        counts.put(countKey, value);
        if (value > 0) issues.add(new AuthorizationPreflightIssue(reasonCode, null, sourceKey, message + ": " + value));
    }

    private long count(String sql, Object... args) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }

    private void audit(String tenantId, Long operatorId, String action) {
        jdbcTemplate.update("""
            INSERT INTO audit_log
                (tenant_id, module, action, target_type, operator_id, remark, created_at)
            VALUES (?, 'authorization', ?, 'tenant', ?, ?, NOW())
            """, tenantId, action, operatorId, "tenant=" + tenantId);
    }

    private void requirePlatformAdministrator(String operatorScope) {
        if (!"platform".equals(operatorScope)) throw new IllegalArgumentException("仅超级管理员可执行严格授权切换");
    }

    private static Long nullableLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private static boolean booleanValue(Object value) {
        return value instanceof Boolean bool && bool;
    }

    private static String stringValue(Object value) {
        return value == null ? null : value.toString();
    }

    private static java.time.LocalDateTime timestamp(Timestamp value) {
        return value == null ? null : value.toLocalDateTime();
    }

    private record CutoverRow(String status, Long epoch, java.time.LocalDateTime enforcedAt) {}
}
