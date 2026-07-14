package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.module.org.GroupMembershipService;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.org.GroupLifecycleService;
import com.cwgsyw.platform.module.org.GroupReferenceInventoryService;
import com.cwgsyw.platform.module.org.UserGroupMembershipMapper;
import com.cwgsyw.platform.module.org.dto.GroupLifecycleActionRequest;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.rbac.RoleAssignmentMapper;
import com.cwgsyw.platform.module.rbac.RoleAssignmentService;
import com.cwgsyw.platform.module.rbac.RoleManagementService;
import com.cwgsyw.platform.module.rbac.dto.RoleAssignmentRequest;
import com.cwgsyw.platform.module.user.UserService;
import com.cwgsyw.platform.module.user.dto.UpdateUserRequest;
import com.cwgsyw.platform.module.user.password.PasswordHistoryService;
import com.cwgsyw.platform.module.user.password.PasswordPolicyService;
import com.cwgsyw.platform.module.auth.session.AuthSessionService;
import com.cwgsyw.platform.module.authorization.AuthorizationRelationshipCleanupService;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationRelationshipCleanupResult;
import com.cwgsyw.platform.config.SecurityProperties;
import com.cwgsyw.platform.config.MyBatisPlusConfig;
import com.cwgsyw.platform.security.SecurityUser;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest(
    classes = AuthorizationPersistenceIntegrationTest.TestApplication.class,
    properties = {
        "spring.main.web-application-type=none",
        "spring.flyway.enabled=true",
        "spring.flyway.validate-on-migrate=false",
        "flowable.database-schema-update=create-drop",
        "flowable.async-executor-activate=false"
    }
)
@Testcontainers
class AuthorizationPersistenceIntegrationTest {
    private static final String PERMISSION_PREFIX = "fqa_authz_it:";

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
        .withDatabaseName("cwgsyw_authorization_it")
        .withUsername("fqa")
        .withPassword("fqa");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired RoleAssignmentMapper roleAssignmentMapper;
    @Autowired ScopedPermissionMapper scopedPermissionMapper;
    @Autowired UserGroupMembershipMapper membershipMapper;
    @Autowired RoleAssignmentService roleAssignmentService;
    @Autowired RoleManagementService roleManagementService;
    @Autowired UserService userService;
    @Autowired RbacService rbacService;
    @Autowired AuthorizationService authorizationService;
    @Autowired GroupMembershipService groupMembershipService;
    @Autowired GroupLifecycleService groupLifecycleService;
    @Autowired AuthorizationWriteLockService writeLockService;
    @Autowired AuthorizationMigrationService migrationService;
    @Autowired PlatformTransactionManager transactionManager;

    @MockBean AuthorizationModeService authorizationModeService;
    @MockBean PasswordEncoder passwordEncoder;
    @MockBean PasswordPolicyService passwordPolicyService;
    @MockBean PasswordHistoryService passwordHistoryService;
    @MockBean AuthSessionService authSessionService;
    @MockBean SecurityProperties securityProperties;
    @MockBean AuthorizationRelationshipCleanupService relationshipCleanupService;
    @MockBean BreakGlassService breakGlassService;

    private ExecutorService executor;

    @BeforeEach
    void enforceAssignmentMode() {
        when(authorizationModeService.effectiveMode(anyString()))
            .thenReturn(AuthorizationModeService.EffectiveMode.ENFORCED);
        when(authorizationModeService.isEnforced(anyString())).thenReturn(true);
    }

    @AfterEach
    void stopExecutor() throws InterruptedException {
        if (executor != null) {
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS));
        }
    }

    @Test
    void effectiveAssignmentQueriesUseTheSameRuntimeContract() {
        Fixture active = fixture("active", "business", false, "default-role", false);
        insertMembership(active, active.tenantId(), active.userId(), active.groupId(), false, false);
        insertAssignment(active, "group", active.groupId(), null, null, false);
        assertEffective(active, true, "group");

        Fixture missingMembership = fixture("missing_membership", "business", false, "default-role", false);
        insertAssignment(missingMembership, "group", missingMembership.groupId(), null, null, false);
        assertEffective(missingMembership, false, "group");

        Fixture deletedMembership = fixture("deleted_membership", "business", false, "default-role", false);
        insertMembership(deletedMembership, deletedMembership.tenantId(), deletedMembership.userId(),
            deletedMembership.groupId(), false, true);
        insertAssignment(deletedMembership, "group", deletedMembership.groupId(), null, null, false);
        assertEffective(deletedMembership, false, "group");

        Fixture membershipTenantMismatch = fixture("membership_tenant_mismatch", "business", false,
            "default-role", false);
        long tenantMismatchMembershipId = insertMembership(membershipTenantMismatch,
            membershipTenantMismatch.tenantId(), membershipTenantMismatch.userId(),
            membershipTenantMismatch.groupId(), false, false);
        jdbcTemplate.update("ALTER TABLE sys_user_group_membership DISABLE TRIGGER trg_sys_user_group_membership_active_group");
        try {
            jdbcTemplate.update("UPDATE sys_user_group_membership SET tenant_id = ? WHERE id = ?",
                tenant("other_membership"), tenantMismatchMembershipId);
        } finally {
            jdbcTemplate.update("ALTER TABLE sys_user_group_membership ENABLE TRIGGER trg_sys_user_group_membership_active_group");
        }
        insertAssignment(membershipTenantMismatch, "group", membershipTenantMismatch.groupId(), null, null, false);
        assertEffective(membershipTenantMismatch, false, "group");

        Fixture membershipUserMismatch = fixture("membership_user_mismatch", "business", false,
            "default-role", false);
        long otherUserId = insertUser(membershipUserMismatch.tenantId(), null, "other_user");
        insertMembership(membershipUserMismatch, membershipUserMismatch.tenantId(), otherUserId,
            membershipUserMismatch.groupId(), false, false);
        insertAssignment(membershipUserMismatch, "group", membershipUserMismatch.groupId(), null, null, false);
        assertEffective(membershipUserMismatch, false, "group");

        Fixture membershipGroupMismatch = fixture("membership_group_mismatch", "business", false,
            "default-role", false);
        long otherGroupId = insertGroup(membershipGroupMismatch.tenantId(), "business", false,
            "other_group");
        insertMembership(membershipGroupMismatch, membershipGroupMismatch.tenantId(),
            membershipGroupMismatch.userId(), otherGroupId, false, false);
        insertAssignment(membershipGroupMismatch, "group", membershipGroupMismatch.groupId(), null, null, false);
        assertEffective(membershipGroupMismatch, false, "group");

        Fixture deletedGroup = fixture("deleted_group", "business", false, "default-role", false);
        insertMembership(deletedGroup, deletedGroup.tenantId(), deletedGroup.userId(), deletedGroup.groupId(),
            false, false);
        insertAssignment(deletedGroup, "group", deletedGroup.groupId(), null, null, false);
        jdbcTemplate.update("UPDATE sys_group SET is_deleted = TRUE, deleted_at = NOW() WHERE id = ?",
            deletedGroup.groupId());
        assertEffective(deletedGroup, false, "group");

        Fixture unassignedGroup = fixture("unassigned_group", "business", false, "default-role", false);
        insertMembership(unassignedGroup, unassignedGroup.tenantId(), unassignedGroup.userId(),
            unassignedGroup.groupId(), false, false);
        insertAssignment(unassignedGroup, "group", unassignedGroup.groupId(), null, null, false);
        jdbcTemplate.update("UPDATE sys_group SET group_type = 'unassigned', is_builtin = TRUE, code = 'unassigned' WHERE id = ?",
            unassignedGroup.groupId());
        assertEffective(unassignedGroup, false, "group");

        Fixture businessGroupWithReservedCode = fixture(
            "business_reserved_code", "business", false, "default-role", false);
        jdbcTemplate.update("UPDATE sys_group SET code = 'unassigned' WHERE id = ?",
            businessGroupWithReservedCode.groupId());
        insertMembership(businessGroupWithReservedCode, businessGroupWithReservedCode.tenantId(),
            businessGroupWithReservedCode.userId(), businessGroupWithReservedCode.groupId(), false, false);
        insertAssignment(businessGroupWithReservedCode, "group",
            businessGroupWithReservedCode.groupId(), null, null, false);
        assertEffective(businessGroupWithReservedCode, true, "group");

        Fixture crossTenantGroup = fixture("cross_tenant_group", "business", false, "default-role", false);
        insertMembership(crossTenantGroup, crossTenantGroup.tenantId(), crossTenantGroup.userId(),
            crossTenantGroup.groupId(), false, false);
        insertAssignment(crossTenantGroup, "group", crossTenantGroup.groupId(), null, null, false);
        jdbcTemplate.update("UPDATE sys_group SET tenant_id = ? WHERE id = ?",
            tenant("cross_group"), crossTenantGroup.groupId());
        assertEffective(crossTenantGroup, false, "group");

        Fixture deletedRole = fixture("deleted_role", "business", false, "default-role", true);
        insertMembership(deletedRole, deletedRole.tenantId(), deletedRole.userId(), deletedRole.groupId(),
            false, false);
        insertAssignment(deletedRole, "group", deletedRole.groupId(), null, null, false);
        assertEffective(deletedRole, false, "group");

        Fixture crossTenantRole = fixture("cross_tenant_role", "business", false, tenant("cross_role"), false);
        insertMembership(crossTenantRole, crossTenantRole.tenantId(), crossTenantRole.userId(),
            crossTenantRole.groupId(), false, false);
        insertAssignment(crossTenantRole, "group", crossTenantRole.groupId(), null, null, false);
        assertEffective(crossTenantRole, false, "group");

        Fixture future = fixture("future", "business", false, "default-role", false);
        insertMembership(future, future.tenantId(), future.userId(), future.groupId(), false, false);
        insertAssignment(future, "group", future.groupId(), LocalDateTime.now().plusDays(1), null, false);
        assertEffective(future, false, "group");

        Fixture expired = fixture("expired", "business", false, "default-role", false);
        insertMembership(expired, expired.tenantId(), expired.userId(), expired.groupId(), false, false);
        insertAssignment(expired, "group", expired.groupId(), null, LocalDateTime.now().minusDays(1), false);
        assertEffective(expired, false, "group");

        Fixture tenantAssignment = fixture("tenant_assignment", "business", false, "default-role", false);
        insertAssignment(tenantAssignment, "tenant", null, null, null, false);
        assertEffective(tenantAssignment, true, "tenant");

        Fixture platformAssignment = fixture("platform_assignment", "business", false, "default-role", false);
        insertAssignment(platformAssignment, "platform", null, null, null, false);
        assertEffective(platformAssignment, true, "platform");

        Fixture deletedAssignment = fixture("deleted_assignment", "business", false, "default-role", false);
        insertMembership(deletedAssignment, deletedAssignment.tenantId(), deletedAssignment.userId(),
            deletedAssignment.groupId(), false, false);
        insertAssignment(deletedAssignment, "group", deletedAssignment.groupId(), null, null, true);
        assertEffective(deletedAssignment, false, "group");

        Fixture multi = fixture("multi", "business", false, "default-role", false);
        insertMembership(multi, multi.tenantId(), multi.userId(), multi.groupId(), false, false);
        insertAssignment(multi, "group", multi.groupId(), null, null, false);
        long secondGroupId = insertGroup(multi.tenantId(), "business", false, "multi_second_group");
        long secondRoleId = insertRole(multi.tenantId(), "group", false, "multi_second_role");
        insertRolePermission(secondRoleId, multi.permissionId());
        insertMembership(multi, multi.tenantId(), multi.userId(), secondGroupId, false, false);
        insertAssignment(multi.tenantId(), multi.userId(), secondRoleId, "group", secondGroupId,
            null, null, false);
        assertEquals(Set.of(multi.roleId(), secondRoleId),
            Set.copyOf(roleAssignmentMapper.findEffectiveRoleIds(multi.tenantId(), multi.userId())));
        assertEquals(2, scopedPermissionMapper.findAssignments(
            multi.tenantId(), multi.userId(), multi.permissionCode()).size());
    }

    @Test
    void archivedGroupIsExcludedFromPermissionScopeAclAndActiveSelectors() {
        Fixture fixture = fixture("archived_acl", "business", false, "default-role", false);
        insertMembership(fixture, fixture.tenantId(), fixture.userId(), fixture.groupId(), false, false);
        insertAssignment(fixture, "group", fixture.groupId(), null, null, false);

        assertEffective(fixture, true, "group");
        assertEquals(1L, count("""
            SELECT COUNT(*) FROM sys_group
            WHERE tenant_id=? AND id=? AND NOT is_deleted AND group_type='business'
            """, fixture.tenantId(), fixture.groupId()));
        assertEquals(List.of(fixture.groupId()), membershipMapper.findActiveGroupIds(
            fixture.tenantId(), fixture.userId()));

        jdbcTemplate.update("""
            UPDATE sys_group
            SET is_deleted=TRUE, deleted_at=NOW(), deleted_by=?, updated_at=NOW(), updated_by=?
            WHERE tenant_id=? AND id=?
            """, fixture.userId(), fixture.userId(), fixture.tenantId(), fixture.groupId());

        assertEffective(fixture, false, "group");
        assertEquals(List.of(), scopedPermissionMapper.findAssignments(
            fixture.tenantId(), fixture.userId(), fixture.permissionCode()));
        assertEquals(0L, count("""
            SELECT COUNT(*) FROM sys_group
            WHERE tenant_id=? AND id=? AND NOT is_deleted AND group_type='business'
            """, fixture.tenantId(), fixture.groupId()));
        assertEquals(0L, count("""
            SELECT COUNT(*) FROM sys_group
            WHERE tenant_id=? AND id=? AND NOT is_deleted
            """, fixture.tenantId(), fixture.groupId()));
        assertEquals(0L, count("""
            SELECT COUNT(*) FROM sys_group
            WHERE tenant_id=? AND id=? AND NOT is_deleted AND group_type='business'
            """, fixture.tenantId(), fixture.groupId()));
    }

    @Test
    void archivedGroupAclCannotGrantAccessThroughDeletedMembership() {
        Fixture fixture = fixture("archived_acl_decision", "business", false, "default-role", false);
        insertMembership(fixture, fixture.tenantId(), fixture.userId(), fixture.groupId(), false, false);
        insertAssignment(fixture, "tenant", null, null, null, false);
        long spaceId = jdbcTemplate.queryForObject("""
            INSERT INTO wiki_space
                (tenant_id, name, owner_user_id, owner_group_id, permission_mode)
            VALUES (?, ?, ?, ?, 0) RETURNING id
            """, Long.class, fixture.tenantId(), "FQA archived ACL", 999999L, fixture.groupId());
        jdbcTemplate.update("""
            INSERT INTO resource_acl_entry
                (tenant_id, resource_type, resource_id, entry_type,
                 subject_type, subject_id, permissions)
            VALUES (?, 'wiki_space', ?, 'access', 'group', ?, 1)
            """, fixture.tenantId(), spaceId, fixture.groupId());
        SecurityUser user = new SecurityUser(fixture.userId(), "fqa-archived-acl", "",
            fixture.tenantId(), null, "tenant", Set.of(fixture.permissionCode()));

        AuthorizationDecision before = authorizationService.decide(
            user, fixture.permissionCode(), "wiki_space", spaceId, 1);
        assertTrue(before.isAllowed());
        assertEquals("group", before.getResourceClass());

        jdbcTemplate.update("""
            UPDATE sys_group
            SET is_deleted=TRUE, deleted_at=NOW(), deleted_by=?, updated_at=NOW(), updated_by=?
            WHERE tenant_id=? AND id=?
            """, fixture.userId(), fixture.userId(), fixture.tenantId(), fixture.groupId());

        AuthorizationDecision after = authorizationService.decide(
            user, fixture.permissionCode(), "wiki_space", spaceId, 1);
        assertFalse(after.isAllowed());
        assertEquals("RESOURCE_ACCESS_DENIED", after.getReasonCode());
        assertEquals("others", after.getResourceClass());
        assertEquals(0, after.getEffectivePermissions());
    }

    @Test
    void membershipRemovalPersistsMetadataAuditsAndNeverRestoresOldAssignment() {
        Fixture fixture = fixture("primary_delete", "business", false, "default-role", false);
        setPrimaryGroup(fixture.userId(), fixture.groupId());
        long membershipId = insertMembership(fixture, fixture.tenantId(), fixture.userId(), fixture.groupId(),
            true, false);
        long assignmentId = insertAssignment(fixture, "group", fixture.groupId(), null, null, false);

        groupMembershipService.remove(fixture.userId(), membershipId, fixture.tenantId(), 9001L);

        assertNull(jdbcTemplate.queryForObject(
            "SELECT group_id FROM sys_user WHERE id = ?", Long.class, fixture.userId()));
        assertSoftDeleted("sys_user_group_membership", membershipId, 9001L);
        assertSoftDeleted("sys_role_assignment", assignmentId, 9001L);
        assertEquals(1L, count("SELECT COUNT(*) FROM audit_log WHERE tenant_id = ? AND action = ?",
            fixture.tenantId(), "membership_remove"));
        assertEquals(1L, count("SELECT COUNT(*) FROM audit_log WHERE tenant_id = ? AND action = ?",
            fixture.tenantId(), "assignment_revoke_on_membership_removal"));

        insertMembership(fixture, fixture.tenantId(), fixture.userId(), fixture.groupId(), true, false);
        assertEffective(fixture, false, "group");
    }

    @Test
    void nonPrimaryRemovalPreservesDifferentPrimaryGroup() {
        Fixture fixture = fixture("non_primary", "business", false, "default-role", false);
        long primaryGroupId = insertGroup(fixture.tenantId(), "business", false, "primary_group");
        setPrimaryGroup(fixture.userId(), primaryGroupId);
        insertMembership(fixture, fixture.tenantId(), fixture.userId(), primaryGroupId, true, false);
        long membershipId = insertMembership(fixture, fixture.tenantId(), fixture.userId(), fixture.groupId(),
            false, false);

        groupMembershipService.remove(fixture.userId(), membershipId, fixture.tenantId(), 9002L);

        assertEquals(primaryGroupId, jdbcTemplate.queryForObject(
            "SELECT group_id FROM sys_user WHERE id = ?", Long.class, fixture.userId()));
        assertSoftDeleted("sys_user_group_membership", membershipId, 9002L);
    }

    @Test
    void legacyPrimaryRemovalClearsGroupAndRevokesAssignments() {
        Fixture fixture = fixture("legacy_primary", "business", false, "default-role", false);
        setPrimaryGroup(fixture.userId(), fixture.groupId());
        long assignmentId = insertAssignment(fixture, "group", fixture.groupId(), null, null, false);

        groupMembershipService.removeByGroup(
            fixture.userId(), fixture.groupId(), fixture.tenantId(), 9003L);

        assertNull(jdbcTemplate.queryForObject(
            "SELECT group_id FROM sys_user WHERE id = ?", Long.class, fixture.userId()));
        assertSoftDeleted("sys_role_assignment", assignmentId, 9003L);
        assertEquals(1L, count("SELECT COUNT(*) FROM audit_log WHERE tenant_id = ? AND action = ?",
            fixture.tenantId(), "membership_remove_legacy"));
        assertEquals(1L, count("SELECT COUNT(*) FROM audit_log WHERE tenant_id = ? AND action = ?",
            fixture.tenantId(), "assignment_revoke_on_membership_removal"));

        insertMembership(fixture, fixture.tenantId(), fixture.userId(), fixture.groupId(), true, false);
        assertEffective(fixture, false, "group");
    }

    @Test
    void zeroRowMembershipUpdateRollsBackAssignmentsAndAudit() {
        Fixture fixture = fixture("zero_row", "business", false, "default-role", false);
        long membershipId = insertMembership(fixture, fixture.tenantId(), fixture.userId(), fixture.groupId(),
            false, false);
        long assignmentId = insertAssignment(fixture, "group", fixture.groupId(), null, null, false);
        jdbcTemplate.execute("""
            CREATE FUNCTION fqa_skip_membership_soft_delete() RETURNS trigger AS $$
            BEGIN
              IF NEW.id = %d AND NEW.is_deleted THEN
                RETURN NULL;
              END IF;
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
            """.formatted(membershipId));
        jdbcTemplate.execute("""
            CREATE TRIGGER fqa_skip_membership_soft_delete_trigger
            BEFORE UPDATE ON sys_user_group_membership
            FOR EACH ROW EXECUTE FUNCTION fqa_skip_membership_soft_delete()
            """);

        try {
            assertThrows(IllegalStateException.class, () -> groupMembershipService.remove(
                fixture.userId(), membershipId, fixture.tenantId(), 9004L));
        } finally {
            jdbcTemplate.execute("DROP TRIGGER fqa_skip_membership_soft_delete_trigger ON sys_user_group_membership");
            jdbcTemplate.execute("DROP FUNCTION fqa_skip_membership_soft_delete()");
        }

        assertEquals(0L, count("SELECT COUNT(*) FROM sys_user_group_membership WHERE id = ? AND is_deleted",
            membershipId));
        assertEquals(0L, count("SELECT COUNT(*) FROM sys_role_assignment WHERE id = ? AND is_deleted",
            assignmentId));
        assertEquals(0L, count("SELECT COUNT(*) FROM audit_log WHERE tenant_id = ?", fixture.tenantId()));
    }

    @Test
    void zeroRowAssignmentUpdateRollsBackMembershipAndAudit() {
        Fixture fixture = fixture("zero_assignment", "business", false, "default-role", false);
        long membershipId = insertMembership(fixture, fixture.tenantId(), fixture.userId(), fixture.groupId(),
            false, false);
        long assignmentId = insertAssignment(fixture, "group", fixture.groupId(), null, null, false);
        installSkipUpdateTrigger("sys_role_assignment", "assignment", assignmentId);

        try {
            assertThrows(IllegalStateException.class, () -> groupMembershipService.remove(
                fixture.userId(), membershipId, fixture.tenantId(), 9006L));
        } finally {
            dropSkipUpdateTrigger("sys_role_assignment", "assignment");
        }

        assertActive("sys_user_group_membership", membershipId);
        assertActive("sys_role_assignment", assignmentId);
        assertEquals(0L, count("SELECT COUNT(*) FROM audit_log WHERE tenant_id = ?", fixture.tenantId()));
    }

    @Test
    void zeroRowPrimaryClearRollsBackMembershipAssignmentAndAudit() {
        Fixture fixture = fixture("zero_primary", "business", false, "default-role", false);
        setPrimaryGroup(fixture.userId(), fixture.groupId());
        long membershipId = insertMembership(fixture, fixture.tenantId(), fixture.userId(), fixture.groupId(),
            true, false);
        long assignmentId = insertAssignment(fixture, "group", fixture.groupId(), null, null, false);
        installSkipUpdateTrigger("sys_user", "primary", fixture.userId());

        try {
            assertThrows(IllegalStateException.class, () -> groupMembershipService.remove(
                fixture.userId(), membershipId, fixture.tenantId(), 9007L));
        } finally {
            dropSkipUpdateTrigger("sys_user", "primary");
        }

        assertEquals(fixture.groupId(), jdbcTemplate.queryForObject(
            "SELECT group_id FROM sys_user WHERE id = ?", Long.class, fixture.userId()));
        assertActive("sys_user_group_membership", membershipId);
        assertActive("sys_role_assignment", assignmentId);
        assertEquals(0L, count("SELECT COUNT(*) FROM audit_log WHERE tenant_id = ?", fixture.tenantId()));
    }

    @Test
    void rejectedAuditInsertRollsBackMembershipAndAssignment() {
        Fixture fixture = fixture("audit_rollback", "business", false, "default-role", false);
        long membershipId = insertMembership(fixture, fixture.tenantId(), fixture.userId(), fixture.groupId(),
            false, false);
        long assignmentId = insertAssignment(fixture, "group", fixture.groupId(), null, null, false);
        jdbcTemplate.execute("""
            CREATE FUNCTION fqa_skip_audit_insert() RETURNS trigger AS $$
            BEGIN
              IF NEW.tenant_id = '%s' THEN RETURN NULL; END IF;
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
            """.formatted(fixture.tenantId()));
        jdbcTemplate.execute("""
            CREATE TRIGGER fqa_skip_audit_insert_trigger
            BEFORE INSERT ON audit_log
            FOR EACH ROW EXECUTE FUNCTION fqa_skip_audit_insert()
            """);

        try {
            assertThrows(IllegalStateException.class, () -> groupMembershipService.remove(
                fixture.userId(), membershipId, fixture.tenantId(), 9008L));
        } finally {
            jdbcTemplate.execute("DROP TRIGGER fqa_skip_audit_insert_trigger ON audit_log");
            jdbcTemplate.execute("DROP FUNCTION fqa_skip_audit_insert()");
        }

        assertActive("sys_user_group_membership", membershipId);
        assertActive("sys_role_assignment", assignmentId);
        assertEquals(0L, count("SELECT COUNT(*) FROM audit_log WHERE tenant_id = ?", fixture.tenantId()));
    }

    @Test
    void removalWritesBoundedSummaryAndOneAuditPerAssignment() {
        Fixture fixture = fixture("bounded_audit", "business", false, "default-role", false);
        long membershipId = insertMembership(fixture, fixture.tenantId(), fixture.userId(), fixture.groupId(),
            false, false);
        insertAssignment(fixture, "group", fixture.groupId(), null, null, false);
        for (int index = 1; index < 6; index++) {
            long roleId = insertRole(fixture.tenantId(), "group", false, "bounded_role_" + index);
            insertRolePermission(roleId, fixture.permissionId());
            insertAssignment(fixture.tenantId(), fixture.userId(), roleId, "group", fixture.groupId(),
                null, null, false);
        }

        groupMembershipService.remove(fixture.userId(), membershipId, fixture.tenantId(), 9005L);

        assertEquals(6L, count("SELECT COUNT(*) FROM audit_log WHERE tenant_id = ? AND action = ?",
            fixture.tenantId(), "assignment_revoke_on_membership_removal"));
        String remark = jdbcTemplate.queryForObject(
            "SELECT remark FROM audit_log WHERE tenant_id = ? AND action = 'membership_remove'",
            String.class, fixture.tenantId());
        assertTrue(remark.contains("revoked_count=6"));
        assertTrue(remark.contains("first_5="));
        assertTrue(remark.length() <= 512);
    }

    @Test
    void addCommitsBeforeRemoveAndRemoveRevokesTheNewAssignment() throws Exception {
        Fixture fixture = fixture("add_first", "business", false, "default-role", false);
        long membershipId = insertMembership(fixture, fixture.tenantId(), fixture.userId(), fixture.groupId(),
            false, false);
        CountDownLatch addComplete = new CountDownLatch(1);
        CountDownLatch commitAdd = new CountDownLatch(1);
        executor = Executors.newFixedThreadPool(2);
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);

        Future<Void> add = executor.submit(() -> {
            transaction.executeWithoutResult(status -> {
                roleAssignmentService.add(fixture.userId(), request(fixture), fixture.tenantId(), 9101L,
                    Set.of(), "platform", null);
                addComplete.countDown();
                await(commitAdd);
            });
            return null;
        });
        Future<Void> remove = executor.submit(() -> {
            assertTrue(addComplete.await(10, TimeUnit.SECONDS));
            groupMembershipService.remove(fixture.userId(), membershipId, fixture.tenantId(), 9102L);
            return null;
        });

        assertTrue(addComplete.await(10, TimeUnit.SECONDS));
        assertFalse(remove.isDone());
        commitAdd.countDown();
        add.get(10, TimeUnit.SECONDS);
        remove.get(10, TimeUnit.SECONDS);

        assertNoActiveOrphan(fixture);
        assertEquals(1L, count("SELECT COUNT(*) FROM sys_role_assignment WHERE tenant_id = ? AND is_deleted",
            fixture.tenantId()));
    }

    @Test
    void removeCommitsBeforeAddAndAddIsRejected() throws Exception {
        Fixture fixture = fixture("remove_first", "business", false, "default-role", false);
        long membershipId = insertMembership(fixture, fixture.tenantId(), fixture.userId(), fixture.groupId(),
            false, false);
        CountDownLatch removeComplete = new CountDownLatch(1);
        CountDownLatch commitRemove = new CountDownLatch(1);
        executor = Executors.newFixedThreadPool(2);
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);

        Future<Void> remove = executor.submit(() -> {
            transaction.executeWithoutResult(status -> {
                groupMembershipService.remove(fixture.userId(), membershipId, fixture.tenantId(), 9201L);
                removeComplete.countDown();
                await(commitRemove);
            });
            return null;
        });
        Future<Void> add = executor.submit(() -> {
            assertTrue(removeComplete.await(10, TimeUnit.SECONDS));
            roleAssignmentService.add(fixture.userId(), request(fixture), fixture.tenantId(), 9202L,
                Set.of(), "platform", null);
            return null;
        });

        assertTrue(removeComplete.await(10, TimeUnit.SECONDS));
        assertFalse(add.isDone());
        commitRemove.countDown();
        remove.get(10, TimeUnit.SECONDS);
        ExecutionException error = assertThrows(ExecutionException.class,
            () -> add.get(10, TimeUnit.SECONDS));
        assertInstanceOf(IllegalArgumentException.class, error.getCause());
        assertNoActiveOrphan(fixture);
    }

    @Test
    void rollbackReleasesLockAndAddUsesTheRestoredMembership() throws Exception {
        Fixture fixture = fixture("rollback", "business", false, "default-role", false);
        long membershipId = insertMembership(fixture, fixture.tenantId(), fixture.userId(), fixture.groupId(),
            false, false);
        CountDownLatch removeComplete = new CountDownLatch(1);
        CountDownLatch rollbackRemove = new CountDownLatch(1);
        executor = Executors.newFixedThreadPool(2);
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);

        Future<Void> remove = executor.submit(() -> {
            assertThrows(ForcedRollback.class, () -> transaction.executeWithoutResult(status -> {
                groupMembershipService.remove(fixture.userId(), membershipId, fixture.tenantId(), 9301L);
                removeComplete.countDown();
                await(rollbackRemove);
                throw new ForcedRollback();
            }));
            return null;
        });
        Future<Void> add = executor.submit(() -> {
            assertTrue(removeComplete.await(10, TimeUnit.SECONDS));
            roleAssignmentService.add(fixture.userId(), request(fixture), fixture.tenantId(), 9302L,
                Set.of(), "platform", null);
            return null;
        });

        assertTrue(removeComplete.await(10, TimeUnit.SECONDS));
        assertFalse(add.isDone());
        rollbackRemove.countDown();
        remove.get(10, TimeUnit.SECONDS);
        add.get(10, TimeUnit.SECONDS);

        assertEquals(1L, count("SELECT COUNT(*) FROM sys_user_group_membership WHERE id = ? AND NOT is_deleted",
            membershipId));
        assertEquals(1L, count("SELECT COUNT(*) FROM sys_role_assignment WHERE tenant_id = ? AND NOT is_deleted",
            fixture.tenantId()));
    }

    @Test
    void assignmentCommitBeforeRoleDeleteMakesDeleteRejectWithoutOrphan() throws Exception {
        Fixture fixture = fixture("role_add_first", "business", false, "default-role", false);
        insertMembership(fixture, fixture.tenantId(), fixture.userId(), fixture.groupId(), false, false);
        CountDownLatch assignmentAdded = new CountDownLatch(1);
        CountDownLatch commitAssignment = new CountDownLatch(1);
        executor = Executors.newFixedThreadPool(2);
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);

        Future<Void> add = executor.submit(() -> {
            transaction.executeWithoutResult(status -> {
                roleAssignmentService.add(fixture.userId(), request(fixture), fixture.tenantId(), 9501L,
                    Set.of(), "platform", null);
                assignmentAdded.countDown();
                await(commitAssignment);
            });
            return null;
        });
        Future<Void> deleteRole = executor.submit(() -> {
            assertTrue(assignmentAdded.await(10, TimeUnit.SECONDS));
            roleManagementService.delete(fixture.roleId(), fixture.tenantId(), 9502L);
            return null;
        });

        assertTrue(assignmentAdded.await(10, TimeUnit.SECONDS));
        assertFalse(deleteRole.isDone());
        commitAssignment.countDown();
        add.get(10, TimeUnit.SECONDS);
        ExecutionException error = assertThrows(ExecutionException.class,
            () -> deleteRole.get(10, TimeUnit.SECONDS));
        assertInstanceOf(IllegalArgumentException.class, error.getCause());
        assertEquals(1L, count("SELECT COUNT(*) FROM sys_role WHERE id = ? AND NOT is_deleted",
            fixture.roleId()));
        assertEquals(1L, count("SELECT COUNT(*) FROM sys_role_assignment WHERE role_id = ? AND NOT is_deleted",
            fixture.roleId()));
    }

    @Test
    void roleDeleteCommitBeforeAssignmentMakesAddRejectWithoutOrphan() throws Exception {
        Fixture fixture = fixture("role_delete_first", "business", false, "default-role", false);
        insertMembership(fixture, fixture.tenantId(), fixture.userId(), fixture.groupId(), false, false);
        CountDownLatch roleDeleted = new CountDownLatch(1);
        CountDownLatch commitDelete = new CountDownLatch(1);
        executor = Executors.newFixedThreadPool(2);
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);

        Future<Void> deleteRole = executor.submit(() -> {
            transaction.executeWithoutResult(status -> {
                roleManagementService.delete(fixture.roleId(), fixture.tenantId(), 9601L);
                roleDeleted.countDown();
                await(commitDelete);
            });
            return null;
        });
        Future<Void> add = executor.submit(() -> {
            assertTrue(roleDeleted.await(10, TimeUnit.SECONDS));
            roleAssignmentService.add(fixture.userId(), request(fixture), fixture.tenantId(), 9602L,
                Set.of(), "platform", null);
            return null;
        });

        assertTrue(roleDeleted.await(10, TimeUnit.SECONDS));
        assertFalse(add.isDone());
        commitDelete.countDown();
        deleteRole.get(10, TimeUnit.SECONDS);
        ExecutionException error = assertThrows(ExecutionException.class,
            () -> add.get(10, TimeUnit.SECONDS));
        assertInstanceOf(IllegalArgumentException.class, error.getCause());
        assertEquals(1L, count("SELECT COUNT(*) FROM sys_role WHERE id = ? AND is_deleted",
            fixture.roleId()));
        assertEquals(0L, count("SELECT COUNT(*) FROM sys_role_assignment WHERE role_id = ? AND NOT is_deleted",
            fixture.roleId()));
    }

    @Test
    void userUpdateWaitsForAuthorizationLockBeforeChangingUserRow() throws Exception {
        Fixture fixture = fixture("user_update_lock", "business", false, "default-role", false);
        CountDownLatch userLocked = new CountDownLatch(1);
        CountDownLatch releaseLock = new CountDownLatch(1);
        executor = Executors.newFixedThreadPool(2);
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);

        Future<Void> holder = executor.submit(() -> {
            transaction.executeWithoutResult(status -> {
                writeLockService.lockUserAuthorization(fixture.tenantId(), fixture.userId());
                userLocked.countDown();
                await(releaseLock);
            });
            return null;
        });
        Future<Void> update = executor.submit(() -> {
            assertTrue(userLocked.await(10, TimeUnit.SECONDS));
            UpdateUserRequest request = new UpdateUserRequest();
            request.setEmail("locked-update@example.com");
            userService.update(fixture.userId(), request, 9701L);
            return null;
        });

        assertTrue(userLocked.await(10, TimeUnit.SECONDS));
        assertFalse(update.isDone());
        assertEquals(0L, count("SELECT COUNT(*) FROM sys_user WHERE id = ? AND email = ?",
            fixture.userId(), "locked-update@example.com"));
        releaseLock.countDown();
        holder.get(10, TimeUnit.SECONDS);
        update.get(10, TimeUnit.SECONDS);
        assertEquals(1L, count("SELECT COUNT(*) FROM sys_user WHERE id = ? AND email = ?",
            fixture.userId(), "locked-update@example.com"));
    }

    @Test
    void userDeleteWaitsForAuthorizationLockBeforeSoftDelete() throws Exception {
        Fixture fixture = fixture("user_delete_lock", "business", false, "default-role", false);
        when(relationshipCleanupService.cleanupDeletedUser(
            fixture.tenantId(), fixture.userId(), 9801L))
            .thenReturn(AuthorizationRelationshipCleanupResult.builder().build());
        CountDownLatch userLocked = new CountDownLatch(1);
        CountDownLatch releaseLock = new CountDownLatch(1);
        executor = Executors.newFixedThreadPool(2);
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);

        Future<Void> holder = executor.submit(() -> {
            transaction.executeWithoutResult(status -> {
                writeLockService.lockUserAuthorization(fixture.tenantId(), fixture.userId());
                userLocked.countDown();
                await(releaseLock);
            });
            return null;
        });
        Future<Void> delete = executor.submit(() -> {
            assertTrue(userLocked.await(10, TimeUnit.SECONDS));
            userService.delete(fixture.userId(), 9801L);
            return null;
        });

        assertTrue(userLocked.await(10, TimeUnit.SECONDS));
        assertFalse(delete.isDone());
        assertEquals(1L, count("SELECT COUNT(*) FROM sys_user WHERE id = ? AND NOT is_deleted",
            fixture.userId()));
        releaseLock.countDown();
        holder.get(10, TimeUnit.SECONDS);
        delete.get(10, TimeUnit.SECONDS);
        assertEquals(1L, count("SELECT COUNT(*) FROM sys_user WHERE id = ? AND is_deleted",
            fixture.userId()));
    }

    @Test
    void legacyCompatibilityWriterDoesNotUseStalePrimaryGroup() {
        Fixture fixture = fixture("legacy_writer", "business", false, "default-role", false);
        setPrimaryGroup(fixture.userId(), fixture.groupId());

        roleAssignmentService.replaceLegacyRoles(fixture.userId(), List.of(fixture.roleId()),
            fixture.tenantId(), fixture.groupId(), 9401L);

        assertEquals(0L, count("SELECT COUNT(*) FROM sys_role_assignment WHERE tenant_id = ? AND NOT is_deleted",
            fixture.tenantId()));
    }

    @Test
    void lifecycleAuditInsertFailureRollsBackArchivedGroup() {
        String tenantId = tenant("lifecycle_audit_rollback");
        long groupId = insertGroup(tenantId, "business", false, "lifecycle_audit_rollback_group");
        LocalDateTime updatedAt = jdbcTemplate.queryForObject(
            "SELECT updated_at FROM sys_group WHERE id = ?", LocalDateTime.class, groupId);
        String groupName = jdbcTemplate.queryForObject(
            "SELECT name FROM sys_group WHERE id = ?", String.class, groupId);
        String functionName = "fqa_reject_group_lifecycle_audit_" + shortId();
        String triggerName = functionName + "_trigger";
        jdbcTemplate.execute("""
            CREATE FUNCTION %s() RETURNS trigger AS $$
            BEGIN
              IF NEW.module = 'group' AND NEW.target_id = %d THEN
                RETURN NULL;
              END IF;
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
            """.formatted(functionName, groupId));
        jdbcTemplate.execute("CREATE TRIGGER " + triggerName
            + " BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION " + functionName + "()");

        try {
            when(authorizationModeService.effectiveMode(tenantId))
                .thenReturn(AuthorizationModeService.EffectiveMode.LEGACY);
            GroupLifecycleActionRequest request = new GroupLifecycleActionRequest();
            request.setReason("REM-P1-001 audit rollback proof");
            request.setConfirmationName(groupName);
            request.setExpectedUpdatedAt(updatedAt);
            SecurityUser operator = new SecurityUser(
                9901L, "fqa-lifecycle-operator", "", tenantId, null,
                "tenant", Set.of("group:delete"));

            assertThrows(IllegalStateException.class,
                () -> groupLifecycleService.archive(groupId, request, operator));
        } finally {
            jdbcTemplate.execute("DROP TRIGGER " + triggerName + " ON audit_log");
            jdbcTemplate.execute("DROP FUNCTION " + functionName + "()");
        }

        assertEquals(1L, count("""
            SELECT COUNT(*) FROM sys_group
            WHERE tenant_id = ? AND id = ? AND NOT is_deleted
              AND deleted_at IS NULL AND deleted_by IS NULL AND updated_at = ?
            """, tenantId, groupId, updatedAt));
        assertEquals(0L, count("""
            SELECT COUNT(*) FROM audit_log
            WHERE tenant_id = ? AND module = 'group' AND target_id = ?
            """, tenantId, groupId));
    }

    @Test
    void migrationReadsAndLocksAuthoritativeLegacyRoleSource() throws Exception {
        Fixture fixture = fixture("migration_source_lock", "business", false, "default-role", false);
        jdbcTemplate.update("UPDATE sys_role SET scope = 'tenant' WHERE id = ?", fixture.roleId());
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)",
            fixture.userId(), fixture.roleId());
        CountDownLatch sourceLocked = new CountDownLatch(1);
        CountDownLatch commitRead = new CountDownLatch(1);
        executor = Executors.newFixedThreadPool(2);
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);

        Future<Void> read = executor.submit(() -> {
            transaction.executeWithoutResult(status -> {
                @SuppressWarnings("unchecked")
                var authoritative = (java.util.Map<String, Object>)
                    org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                        migrationService, "lockAuthoritativeUserRole", fixture.userId(), fixture.roleId());
                assertEquals("tenant", authoritative.get("scope"));
                sourceLocked.countDown();
                await(commitRead);
            });
            return null;
        });
        Future<Void> removeSource = executor.submit(() -> {
            assertTrue(sourceLocked.await(10, TimeUnit.SECONDS));
            jdbcTemplate.update("DELETE FROM sys_user_role WHERE user_id = ? AND role_id = ?",
                fixture.userId(), fixture.roleId());
            return null;
        });

        assertTrue(sourceLocked.await(10, TimeUnit.SECONDS));
        assertFalse(removeSource.isDone());
        commitRead.countDown();
        read.get(10, TimeUnit.SECONDS);
        removeSource.get(10, TimeUnit.SECONDS);
        assertEquals(0L, count("SELECT COUNT(*) FROM sys_user_role WHERE user_id = ? AND role_id = ?",
            fixture.userId(), fixture.roleId()));
    }

    private void assertEffective(Fixture fixture, boolean expected, String expectedScope) {
        assertEquals(expected, roleAssignmentMapper.findEffectiveRoleIds(
            fixture.tenantId(), fixture.userId()).contains(fixture.roleId()));
        assertEquals(expected, roleAssignmentMapper.findEffectiveScopes(
            fixture.tenantId(), fixture.userId()).contains(expectedScope));
        assertEquals(expected, roleAssignmentMapper.findEffectiveScopesForPermission(
            fixture.tenantId(), fixture.userId(), fixture.permissionCode()).contains(expectedScope));
        assertEquals(expected, !scopedPermissionMapper.findAssignments(
            fixture.tenantId(), fixture.userId(), fixture.permissionCode()).isEmpty());
        assertEquals(expected, rbacService.getUserRoleIds(fixture.userId()).contains(fixture.roleId()));
        assertEquals(expected, rbacService.getUserPermissions(fixture.userId())
            .contains(fixture.permissionCode()));
        assertEquals(expectedScope, rbacService.getHighestScope(fixture.userId()));
    }

    private Fixture fixture(String label, String groupType, boolean groupDeleted,
                            String roleTenant, boolean roleDeleted) {
        return fixture(label, groupType, groupDeleted, roleTenant, roleDeleted, null);
    }

    private Fixture fixture(String label, String groupType, boolean groupDeleted,
                            String roleTenant, boolean roleDeleted, String explicitGroupTenant) {
        String tenantId = tenant(label);
        String groupTenant = explicitGroupTenant == null ? tenantId : explicitGroupTenant;
        long groupId = insertGroup(groupTenant, groupType, groupDeleted, label + "_group");
        long userId = insertUser(tenantId, null, label + "_user");
        String resolvedRoleTenant = "default-role".equals(roleTenant) ? tenantId : roleTenant;
        long roleId = insertRole(resolvedRoleTenant, "group", roleDeleted, label + "_role");
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        long resourceId = jdbcTemplate.queryForObject(
            "INSERT INTO sys_resource (code, name, actions) VALUES (?, ?, '[]'::jsonb) RETURNING id",
            Long.class, "fqa_it_resource_" + suffix, "FQA Integration Resource");
        String permissionCode = PERMISSION_PREFIX + suffix;
        long permissionId = jdbcTemplate.queryForObject("""
            INSERT INTO sys_permission (resource_id, action, code, name)
            VALUES (?, 'read', ?, 'FQA Integration Read') RETURNING id
            """, Long.class, resourceId, permissionCode);
        insertRolePermission(roleId, permissionId);
        return new Fixture(tenantId, userId, groupId, roleId, permissionId, permissionCode);
    }

    private long insertGroup(String tenantId, String groupType, boolean deleted, String label) {
        String code = "unassigned".equals(groupType)
            ? "unassigned"
            : "fqa_" + label + "_" + shortId();
        return jdbcTemplate.queryForObject("""
            INSERT INTO sys_group
                (tenant_id, code, name, group_type, is_builtin, is_deleted,
                 deleted_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? THEN NOW() ELSE NULL END, NOW(), NOW())
            RETURNING id
            """, Long.class, tenantId, code, "FQA " + label, groupType,
            "unassigned".equals(groupType), deleted, deleted);
    }

    private long insertUser(String tenantId, Long groupId, String label) {
        return jdbcTemplate.queryForObject("""
            INSERT INTO sys_user
                (tenant_id, group_id, username, password, status, is_deleted, created_at, updated_at)
            VALUES (?, ?, ?, 'not-used-in-integration-test', 1, false, NOW(), NOW())
            RETURNING id
            """, Long.class, tenantId, groupId, "fqa_" + label + "_" + shortId());
    }

    private long insertRole(String tenantId, String scope, boolean deleted, String label) {
        return jdbcTemplate.queryForObject("""
            INSERT INTO sys_role
                (tenant_id, name, code, scope, role_type, is_builtin, is_legacy,
                 is_deleted, deleted_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'functional', false, false, ?,
                    CASE WHEN ? THEN NOW() ELSE NULL END, NOW(), NOW())
            RETURNING id
            """, Long.class, tenantId, "FQA " + label,
            "fqa_" + label + "_" + shortId(), scope, deleted, deleted);
    }

    private void insertRolePermission(long roleId, long permissionId) {
        jdbcTemplate.update(
            "INSERT INTO sys_role_permission (role_id, permission_id) VALUES (?, ?)",
            roleId, permissionId);
    }

    private long insertMembership(Fixture fixture, String tenantId, long userId, long groupId,
                                  boolean primary, boolean deleted) {
        return jdbcTemplate.queryForObject("""
            INSERT INTO sys_user_group_membership
                (tenant_id, user_id, group_id, membership_role, is_primary, origin_type,
                 is_deleted, deleted_at, deleted_by, created_at, updated_at)
            VALUES (?, ?, ?, 'member', ?, 'manual', ?,
                    CASE WHEN ? THEN NOW() ELSE NULL END,
                    CASE WHEN ? THEN 9999 ELSE NULL END, NOW(), NOW())
            RETURNING id
            """, Long.class, tenantId, userId, groupId, primary, deleted, deleted, deleted);
    }

    private long insertAssignment(Fixture fixture, String scopeType, Long scopeId,
                                  LocalDateTime validFrom, LocalDateTime validUntil, boolean deleted) {
        return insertAssignment(fixture.tenantId(), fixture.userId(), fixture.roleId(), scopeType,
            scopeId, validFrom, validUntil, deleted);
    }

    private long insertAssignment(String tenantId, long userId, long roleId, String scopeType,
                                  Long scopeId, LocalDateTime validFrom,
                                  LocalDateTime validUntil, boolean deleted) {
        return jdbcTemplate.queryForObject("""
            INSERT INTO sys_role_assignment
                (tenant_id, user_id, role_id, scope_type, scope_id, valid_from, valid_until,
                 origin_type, is_deleted, deleted_at, deleted_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?,
                    CASE WHEN ? THEN NOW() ELSE NULL END,
                    CASE WHEN ? THEN 9999 ELSE NULL END, NOW(), NOW())
            RETURNING id
            """, Long.class, tenantId, userId, roleId, scopeType, scopeId, validFrom,
            validUntil, deleted, deleted, deleted);
    }

    private RoleAssignmentRequest request(Fixture fixture) {
        RoleAssignmentRequest request = new RoleAssignmentRequest();
        request.setRoleId(fixture.roleId());
        request.setScopeType("group");
        request.setScopeId(fixture.groupId());
        return request;
    }

    private void setPrimaryGroup(long userId, long groupId) {
        assertEquals(1, jdbcTemplate.update(
            "UPDATE sys_user SET group_id = ?, updated_at = NOW() WHERE id = ?", groupId, userId));
    }

    private void assertSoftDeleted(String table, long id, long operatorId) {
        assertEquals(1L, count("SELECT COUNT(*) FROM " + table
            + " WHERE id = ? AND is_deleted AND deleted_at IS NOT NULL AND deleted_by = ?",
            id, operatorId));
    }

    private void assertActive(String table, long id) {
        assertEquals(1L, count("SELECT COUNT(*) FROM " + table
            + " WHERE id = ? AND NOT is_deleted AND deleted_at IS NULL AND deleted_by IS NULL", id));
    }

    private void installSkipUpdateTrigger(String table, String label, long id) {
        jdbcTemplate.execute("""
            CREATE FUNCTION fqa_skip_%s_update() RETURNS trigger AS $$
            BEGIN
              IF NEW.id = %d THEN RETURN NULL; END IF;
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
            """.formatted(label, id));
        jdbcTemplate.execute("""
            CREATE TRIGGER fqa_skip_%s_update_trigger
            BEFORE UPDATE ON %s
            FOR EACH ROW EXECUTE FUNCTION fqa_skip_%s_update()
            """.formatted(label, table, label));
    }

    private void dropSkipUpdateTrigger(String table, String label) {
        jdbcTemplate.execute("DROP TRIGGER fqa_skip_" + label + "_update_trigger ON " + table);
        jdbcTemplate.execute("DROP FUNCTION fqa_skip_" + label + "_update()");
    }

    private void assertNoActiveOrphan(Fixture fixture) {
        assertEquals(0L, count("""
            SELECT COUNT(*)
            FROM sys_role_assignment assignment
            WHERE assignment.tenant_id = ?
              AND assignment.user_id = ?
              AND assignment.scope_type = 'group'
              AND NOT assignment.is_deleted
              AND NOT EXISTS (
                SELECT 1
                FROM sys_user_group_membership membership
                WHERE membership.tenant_id = assignment.tenant_id
                  AND membership.user_id = assignment.user_id
                  AND membership.group_id = assignment.scope_id
                  AND NOT membership.is_deleted
              )
            """, fixture.tenantId(), fixture.userId()));
    }

    private long count(String sql, Object... args) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }

    private static String tenant(String label) {
        return "fqa_it_" + label + "_" + shortId();
    }

    private static String shortId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(10, TimeUnit.SECONDS)) {
                throw new IllegalStateException("integration-test latch timed out");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("integration-test latch interrupted", exception);
        }
    }

    record Fixture(String tenantId, long userId, long groupId, long roleId,
                   long permissionId, String permissionCode) {}

    static final class ForcedRollback extends RuntimeException {}

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @MapperScan("com.cwgsyw.platform")
    @Import({
        AuthorizationWriteLockService.class,
        AuthorizationMigrationService.class,
        RoleAssignmentService.class,
        RoleManagementService.class,
        GroupMembershipService.class,
        ActiveGroupReferenceValidator.class,
        GroupReferenceInventoryService.class,
        GroupLifecycleService.class,
        AuthorizationService.class,
        ResourceDescriptorRepository.class,
        RbacService.class,
        UserService.class,
        MyBatisPlusConfig.class
    })
    static class TestApplication {}
}
