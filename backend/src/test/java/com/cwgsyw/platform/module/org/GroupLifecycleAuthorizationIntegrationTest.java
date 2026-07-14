package com.cwgsyw.platform.module.org;

import com.cwgsyw.platform.config.MyBatisPlusConfig;
import com.cwgsyw.platform.module.authorization.AuthorizationModeService;
import com.cwgsyw.platform.module.authorization.AuthorizationWriteLockService;
import com.cwgsyw.platform.module.org.dto.GroupLifecycleActionRequest;
import com.cwgsyw.platform.module.rbac.RoleAssignmentService;
import com.cwgsyw.platform.security.SecurityUser;
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
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest(
    classes = GroupLifecycleAuthorizationIntegrationTest.TestApplication.class,
    properties = {
        "spring.main.web-application-type=none",
        "spring.flyway.enabled=true",
        "spring.flyway.validate-on-migrate=false",
        "flowable.database-schema-update=create-drop",
        "flowable.async-executor-activate=false"
    }
)
@Testcontainers
class GroupLifecycleAuthorizationIntegrationTest {
    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
        .withDatabaseName("cwgsyw_group_authz_it")
        .withUsername("fqa")
        .withPassword("fqa");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired GroupLifecycleService lifecycleService;
    @Autowired RoleAssignmentService roleAssignmentService;

    @MockBean AuthorizationModeService authorizationModeService;

    @BeforeEach
    void enforcedMode() {
        when(authorizationModeService.effectiveMode(anyString()))
            .thenReturn(AuthorizationModeService.EffectiveMode.ENFORCED);
    }

    @Test
    void missingArchivePermissionReturns403BeforeGroupLookupOrMutation() {
        Fixture fixture = fixture("archive_missing_permission", "tenant");
        Snapshot before = snapshot(fixture);

        GroupLifecycleException failure = assertThrows(GroupLifecycleException.class,
            () -> lifecycleService.preflight(fixture.groupId(), "archive", operator(fixture)));

        assertEquals(403, failure.getHttpStatus());
        assertEquals("ACCESS_DENIED", failure.getErrorCode());
        assertEquals(List.of(), roleAssignmentService.findEffectiveScopesForPermission(
            fixture.userId(), fixture.tenantId(), "group:delete"));
        assertEquals(before, snapshot(fixture));
    }

    @Test
    void groupScopedArchivePermissionReturns403WithoutMutation() {
        Fixture fixture = fixture("archive_group_scope", "group");
        insertMembership(fixture);
        insertAssignment(fixture, "group", fixture.groupId(), null);
        Snapshot before = snapshot(fixture);

        assertEquals(List.of("group"), roleAssignmentService.findEffectiveScopesForPermission(
            fixture.userId(), fixture.tenantId(), "group:delete"));
        GroupLifecycleException failure = assertThrows(GroupLifecycleException.class,
            () -> lifecycleService.preflight(fixture.groupId(), "archive", operator(fixture)));

        assertEquals(403, failure.getHttpStatus());
        assertEquals("GROUP_LIFECYCLE_SCOPE_DENIED", failure.getErrorCode());
        assertEquals(before, snapshot(fixture));
    }

    @Test
    void expiredArchiveAssignmentReturns403WithoutMutation() {
        Fixture fixture = fixture("archive_expired", "tenant");
        insertAssignment(fixture, "tenant", null, LocalDateTime.now().minusDays(1));
        Snapshot before = snapshot(fixture);

        assertEquals(List.of(), roleAssignmentService.findEffectiveScopesForPermission(
            fixture.userId(), fixture.tenantId(), "group:delete"));
        GroupLifecycleException failure = assertThrows(GroupLifecycleException.class,
            () -> lifecycleService.preflight(fixture.groupId(), "archive", operator(fixture)));

        assertEquals(403, failure.getHttpStatus());
        assertEquals("ACCESS_DENIED", failure.getErrorCode());
        assertEquals(before, snapshot(fixture));
    }

    @Test
    void missingPurgePermissionReturns403WithoutMutation() {
        Fixture fixture = fixture("purge_missing_permission", "platform");
        archiveDirectly(fixture);
        Snapshot before = snapshot(fixture);

        GroupLifecycleException failure = assertThrows(GroupLifecycleException.class,
            () -> lifecycleService.preflight(fixture.groupId(), "purge", operator(fixture)));

        assertEquals(403, failure.getHttpStatus());
        assertEquals("ACCESS_DENIED", failure.getErrorCode());
        assertEquals(List.of(), roleAssignmentService.findEffectiveScopesForPermission(
            fixture.userId(), fixture.tenantId(), "group:purge"));
        assertEquals(before, snapshot(fixture));
    }

    @Test
    void tenantScopedPurgePermissionReturns403WithoutMutation() {
        Fixture fixture = fixture("purge_tenant_scope", "platform");
        archiveDirectly(fixture);
        insertAssignment(fixture, "tenant", null, null);
        Snapshot before = snapshot(fixture);

        assertEquals(List.of("tenant"), roleAssignmentService.findEffectiveScopesForPermission(
            fixture.userId(), fixture.tenantId(), "group:purge"));
        GroupLifecycleException failure = assertThrows(GroupLifecycleException.class,
            () -> lifecycleService.preflight(fixture.groupId(), "purge", operator(fixture)));

        assertEquals(403, failure.getHttpStatus());
        assertEquals("GROUP_LIFECYCLE_SCOPE_DENIED", failure.getErrorCode());
        assertEquals(before, snapshot(fixture));
    }

    @Test
    void builtinUnassignedAndCrossTenantArchiveRejectWithoutMutation() {
        assertProtectedArchive("builtin", true, "business", "GROUP_BUILTIN_PROTECTED");
        assertProtectedArchive("unassigned", false, "unassigned", "GROUP_UNASSIGNED_PROTECTED");

        Fixture target = fixture("cross_tenant_target", "tenant");
        Fixture operator = fixture("cross_tenant_operator", "tenant");
        insertAssignment(operator, "tenant", null, null);
        Snapshot targetBefore = snapshot(target);
        Snapshot operatorBefore = snapshot(operator);
        GroupLifecycleActionRequest request = request(target);

        GroupLifecycleException failure = assertThrows(GroupLifecycleException.class,
            () -> lifecycleService.archive(target.groupId(), request, operator(operator)));

        assertEquals(404, failure.getHttpStatus());
        assertEquals("GROUP_NOT_FOUND", failure.getErrorCode());
        assertEquals(targetBefore, snapshot(target));
        assertEquals(operatorBefore, snapshot(operator));
    }

    private void assertProtectedArchive(String label, boolean builtin, String groupType,
                                        String expectedCode) {
        Fixture fixture = fixture(label, "tenant", builtin, groupType);
        insertAssignment(fixture, "tenant", null, null);
        Snapshot before = snapshot(fixture);

        GroupLifecycleException failure = assertThrows(GroupLifecycleException.class,
            () -> lifecycleService.archive(fixture.groupId(), request(fixture), operator(fixture)));

        assertEquals(409, failure.getHttpStatus());
        assertEquals(expectedCode, failure.getErrorCode());
        assertNotNull(failure.getPreflight());
        assertEquals(before, snapshot(fixture));
    }

    private Fixture fixture(String label, String roleScope) {
        return fixture(label, roleScope, false, "business");
    }

    private Fixture fixture(String label, String roleScope, boolean builtin, String groupType) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String tenantId = "fqa_gl_authz_" + label + "_" + suffix;
        String groupName = "FQA " + label + " " + suffix;
        String groupCode = "unassigned".equals(groupType)
            ? "unassigned" : "fqa_" + label + "_" + suffix;
        boolean effectiveBuiltin = builtin || "unassigned".equals(groupType);
        long groupId = id("""
            INSERT INTO sys_group (tenant_id, code, name, group_type, is_builtin)
            VALUES (?, ?, ?, ?, ?) RETURNING id
            """, tenantId, groupCode, groupName, groupType, effectiveBuiltin);
        long userId = id("""
            INSERT INTO sys_user (tenant_id, username, password, status)
            VALUES (?, ?, 'hash', 1) RETURNING id
            """, tenantId, "fqa_user_" + suffix);
        long roleId = id("""
            INSERT INTO sys_role
                (tenant_id, name, code, scope, role_type, is_builtin, is_legacy)
            VALUES (?, ?, ?, ?, 'functional', FALSE, FALSE) RETURNING id
            """, tenantId, "FQA role " + suffix, "fqa_role_" + suffix, roleScope);
        String permissionCode = label.startsWith("purge_") ? "group:purge" : "group:delete";
        Long permissionId = jdbcTemplate.queryForObject(
            "SELECT id FROM sys_permission WHERE code=?", Long.class, permissionCode);
        jdbcTemplate.update("""
            INSERT INTO sys_role_permission (role_id, permission_id) VALUES (?, ?)
            """, roleId, permissionId);
        return new Fixture(tenantId, groupId, groupName, userId, roleId);
    }

    private void insertMembership(Fixture fixture) {
        jdbcTemplate.update("""
            INSERT INTO sys_user_group_membership
                (tenant_id, user_id, group_id, membership_role, is_primary, origin_type,
                 is_deleted, created_at, updated_at)
            VALUES (?, ?, ?, 'member', FALSE, 'manual', FALSE, NOW(), NOW())
            """, fixture.tenantId(), fixture.userId(), fixture.groupId());
    }

    private void insertAssignment(Fixture fixture, String scopeType, Long scopeId,
                                  LocalDateTime validUntil) {
        jdbcTemplate.update("""
            INSERT INTO sys_role_assignment
                (tenant_id, user_id, role_id, scope_type, scope_id, valid_until,
                 origin_type, is_deleted, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'manual', FALSE, NOW(), NOW())
            """, fixture.tenantId(), fixture.userId(), fixture.roleId(), scopeType, scopeId, validUntil);
    }

    private void archiveDirectly(Fixture fixture) {
        jdbcTemplate.update("""
            UPDATE sys_group
            SET is_deleted=TRUE, deleted_at=NOW() - INTERVAL '40 days', deleted_by=?,
                updated_at=NOW(), updated_by=?
            WHERE tenant_id=? AND id=?
            """, fixture.userId(), fixture.userId(), fixture.tenantId(), fixture.groupId());
    }

    private GroupLifecycleActionRequest request(Fixture fixture) {
        GroupLifecycleActionRequest request = new GroupLifecycleActionRequest();
        request.setReason("REM-P1-001 auditable authorization rejection proof");
        request.setConfirmationName(fixture.groupName());
        request.setExpectedUpdatedAt(jdbcTemplate.queryForObject(
            "SELECT updated_at FROM sys_group WHERE tenant_id=? AND id=?",
            LocalDateTime.class, fixture.tenantId(), fixture.groupId()));
        return request;
    }

    private SecurityUser operator(Fixture fixture) {
        return new SecurityUser(fixture.userId(), "fqa-operator", "", fixture.tenantId(), null,
            "platform", Set.of("group:delete", "group:purge"));
    }

    private Snapshot snapshot(Fixture fixture) {
        return new Snapshot(
            jdbcTemplate.queryForMap("""
                SELECT tenant_id, id, is_deleted, deleted_at, deleted_by, updated_at, updated_by
                FROM sys_group WHERE tenant_id=? AND id=?
                """, fixture.tenantId(), fixture.groupId()).toString(),
            jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM audit_log
                WHERE tenant_id=? AND module='group' AND target_id=?
                """, Long.class, fixture.tenantId(), fixture.groupId())
        );
    }

    private long id(String sql, Object... args) {
        Long id = jdbcTemplate.queryForObject(sql, Long.class, args);
        assertNotNull(id);
        return id;
    }

    private record Fixture(String tenantId, long groupId, String groupName, long userId, long roleId) {}
    private record Snapshot(String groupRow, long lifecycleAuditCount) {}

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @MapperScan(basePackages = "com.cwgsyw.platform")
    @Import({
        MyBatisPlusConfig.class,
        GroupLifecycleService.class,
        GroupReferenceInventoryService.class,
        RoleAssignmentService.class,
        AuthorizationWriteLockService.class,
        ActiveGroupReferenceValidator.class
    })
    static class TestApplication {}
}
