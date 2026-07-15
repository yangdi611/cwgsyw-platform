package com.cwgsyw.platform.module.org;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.sql.Statement;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Testcontainers
class GroupLifecycleMigrationIntegrationTest {
    private static final String INACTIVE_SQL_STATE = "P7201";
    private static final String INVALID_SQL_STATE = "P7202";

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
        .withDatabaseName("cwgsyw_group_lifecycle_it")
        .withUsername("fqa")
        .withPassword("fqa");

    private static String groupSnapshotBeforeV72;
    private static String groupSnapshotAfterV72;
    private ExecutorService executor;

    @BeforeAll
    static void migrateFromV71ToV72() throws SQLException {
        flyway(MigrationVersion.fromVersion("71")).migrate();
        groupSnapshotBeforeV72 = groupSnapshot();
        flyway(MigrationVersion.LATEST).migrate();
        groupSnapshotAfterV72 = groupSnapshot();
    }

    @AfterEach
    void stopExecutor() throws InterruptedException {
        if (executor != null) {
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS));
        }
    }

    @Test
    void migrationAddsOnlyExpectedLifecycleArtifactsAndPermission() throws SQLException {
        assertEquals(groupSnapshotBeforeV72, groupSnapshotAfterV72);

        try (Connection connection = connection()) {
            assertEquals(1, queryInt(connection, """
                SELECT COUNT(*) FROM flyway_schema_history
                WHERE version = '72' AND success
                """));
            assertEquals(1, queryInt(connection, """
                SELECT COUNT(*) FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname = 'idx_sys_group_tenant_archived'
                  AND indexdef LIKE '%WHERE is_deleted%'
                """));
            assertEquals(5, queryInt(connection, """
                SELECT COUNT(*) FROM pg_proc
                WHERE proname IN (
                    'require_active_business_group',
                    'parse_group_reference_id',
                    'require_active_visible_groups',
                    'require_active_ops_rule_groups',
                    'enforce_active_group_scalar_reference'
                )
                """));
            assertEquals(18, queryInt(connection, """
                SELECT COUNT(*) FROM pg_trigger
                WHERE NOT tgisinternal AND tgname LIKE 'trg_%_active_group%'
                """));
            assertEquals(0, queryInt(connection, """
                SELECT COUNT(*)
                FROM pg_trigger trigger
                JOIN pg_class table_definition ON table_definition.oid = trigger.tgrelid
                WHERE NOT trigger.tgisinternal
                  AND table_definition.relname LIKE 'act\\_%' ESCAPE '\\'
                """));
            assertEquals(1, queryInt(connection, """
                SELECT COUNT(*) FROM sys_permission
                WHERE code = 'group:purge' AND action = 'purge'
                """));
            assertTrue(queryBoolean(connection, """
                SELECT actions ? 'purge' FROM sys_resource WHERE code = 'group'
                """));
            assertEquals(1, queryInt(connection, """
                SELECT COUNT(*)
                FROM sys_role_permission role_permission
                JOIN sys_role role ON role.id = role_permission.role_id
                JOIN sys_permission permission ON permission.id = role_permission.permission_id
                WHERE permission.code = 'group:purge'
                  AND role.scope = 'platform'
                  AND role.role_type = 'management'
                  AND role.is_builtin
                  AND NOT role.is_deleted
                """));
            assertEquals(0, queryInt(connection, """
                SELECT COUNT(*)
                FROM sys_role_permission role_permission
                JOIN sys_role role ON role.id = role_permission.role_id
                JOIN sys_permission permission ON permission.id = role_permission.permission_id
                WHERE permission.code = 'group:purge'
                  AND NOT (
                      role.scope = 'platform'
                      AND role.role_type = 'management'
                      AND role.is_builtin
                      AND NOT role.is_deleted
                  )
                """));
        }
    }

    @Test
    void everyRegisteredWriterAcceptsActiveBusinessGroup() throws SQLException {
        try (Connection connection = connection()) {
            connection.setAutoCommit(false);
            Fixture fixture = fixture(connection, "valid");

            for (WriterCase writerCase : writerCases(fixture)) {
                try (Statement statement = connection.createStatement()) {
                    statement.executeUpdate(writerCase.sql());
                }
            }

            connection.rollback();
        }
    }

    @Test
    void everyRegisteredWriterRejectsArchivedGroupWithStableSqlState() throws SQLException {
        try (Connection connection = connection()) {
            connection.setAutoCommit(false);
            Fixture fixture = fixture(connection, "archived");
            update(connection, "UPDATE sys_group SET is_deleted = TRUE, deleted_at = NOW() WHERE id = ?",
                fixture.groupId());

            for (WriterCase writerCase : writerCases(fixture)) {
                Savepoint savepoint = connection.setSavepoint(writerCase.name());
                SQLException failure = assertThrows(SQLException.class, () -> {
                    try (Statement statement = connection.createStatement()) {
                        statement.executeUpdate(writerCase.sql());
                    }
                }, writerCase.name());
                assertSqlFailure(failure, INACTIVE_SQL_STATE, "GROUP_REFERENCE_INACTIVE");
                connection.rollback(savepoint);
            }

            connection.rollback();
        }
    }

    @Test
    void helperRejectsMissingCrossTenantAndNonBusinessGroups() throws SQLException {
        try (Connection connection = connection()) {
            connection.setAutoCommit(false);
            Fixture fixture = fixture(connection, "invalid_targets");
            long nonBusinessGroupId = insertGroup(connection, fixture.tenantId(), "unassigned", true,
                "unassigned");
            String otherTenant = fixture.tenantId() + "_other";
            long crossTenantGroupId = insertGroup(connection, otherTenant, "business", false, unique("cross"));

            assertHelperFailure(connection, fixture.tenantId(), Long.MAX_VALUE);
            assertHelperFailure(connection, fixture.tenantId(), crossTenantGroupId);
            assertHelperFailure(connection, fixture.tenantId(), nonBusinessGroupId);
            connection.rollback();
        }
    }

    @Test
    void inactiveHistoricalRowsAndNonGroupSubjectsRemainWritable() throws SQLException {
        try (Connection connection = connection()) {
            connection.setAutoCommit(false);
            Fixture fixture = fixture(connection, "historical");
            update(connection, "UPDATE sys_group SET is_deleted = TRUE, deleted_at = NOW() WHERE id = ?",
                fixture.groupId());

            update(connection, """
                INSERT INTO sys_user_group_membership
                    (tenant_id, user_id, group_id, membership_role, origin_type, is_deleted, deleted_at)
                VALUES (?, ?, ?, 'member', 'manual', TRUE, NOW())
                """, fixture.tenantId(), fixture.userId(), fixture.groupId());
            update(connection, """
                INSERT INTO sys_role_assignment
                    (tenant_id, user_id, role_id, scope_type, scope_id, origin_type, is_deleted, deleted_at)
                VALUES (?, ?, ?, 'group', ?, 'manual', TRUE, NOW())
                """, fixture.tenantId(), fixture.userId(), fixture.roleId(), fixture.groupId());
            update(connection, """
                INSERT INTO resource_acl_entry
                    (tenant_id, resource_type, resource_id, entry_type, subject_type, subject_id, permissions)
                VALUES (?, 'wiki_space', ?, 'access', 'user', ?, 4)
                """, fixture.tenantId(), fixture.wikiSpaceId(), fixture.groupId());
            update(connection, """
                INSERT INTO sys_role_assignment
                    (tenant_id, user_id, role_id, scope_type, scope_id, origin_type)
                VALUES (?, ?, ?, 'tenant', NULL, 'manual')
                """, fixture.tenantId(), fixture.userId(), fixture.roleId());

            connection.rollback();
        }
    }

    @Test
    void jsonReferencesAcceptNumbersAndNumericStringsButRejectMalformedValues() throws SQLException {
        try (Connection connection = connection()) {
            connection.setAutoCommit(false);
            Fixture fixture = fixture(connection, "json");

            update(connection, """
                INSERT INTO shared_file
                    (tenant_id, folder_id, name, original_name, file_type, size_bytes, minio_key,
                     visible_groups, created_by)
                VALUES (?, ?, ?, ?, 'txt', 1, ?, jsonb_build_array(?::BIGINT, ?::TEXT), 0)
                """, fixture.tenantId(), fixture.folderId(), unique("json-valid"), "valid.txt",
                unique("minio"), fixture.groupId(), fixture.groupId());

            assertInvalidJsonFailure(connection, fixture, "jsonb_build_array('not-a-number')");
            assertInvalidJsonFailure(connection, fixture, "jsonb_build_array(jsonb_build_object('id', 1))");
            assertInvalidOpsRuleFailure(connection, fixture, "{not-json}");
            connection.rollback();
        }
    }

    @Test
    void updateFromActiveToArchivedGroupIsRejected() throws SQLException {
        try (Connection connection = connection()) {
            connection.setAutoCommit(false);
            Fixture fixture = fixture(connection, "update");
            long secondGroupId = insertGroup(connection, fixture.tenantId(), "business", false, unique("second"));
            long deviceId = insertId(connection, """
                INSERT INTO device (tenant_id, group_id, name, device_type)
                VALUES (?, ?, ?, 'server') RETURNING id
                """, fixture.tenantId(), fixture.groupId(), unique("device"));
            update(connection, "UPDATE sys_group SET is_deleted = TRUE, deleted_at = NOW() WHERE id = ?",
                secondGroupId);

            SQLException failure = assertThrows(SQLException.class,
                () -> update(connection, "UPDATE device SET group_id = ? WHERE id = ?", secondGroupId, deviceId));
            assertSqlFailure(failure, INACTIVE_SQL_STATE, "GROUP_REFERENCE_INACTIVE");
            connection.rollback();
        }
    }

    @Test
    void archiveFirstMakesWaitingWriterRejectAfterCommit() {
        assertTimeoutPreemptively(Duration.ofSeconds(15), () -> {
            executor = Executors.newFixedThreadPool(2);
            CountDownLatch archivedWithoutCommit = new CountDownLatch(1);
            CountDownLatch allowArchiveCommit = new CountDownLatch(1);

            try (Connection setup = connection()) {
                setup.setAutoCommit(false);
                Fixture fixture = fixture(setup, "archive_first");
                setup.commit();

                Future<Void> archive = executor.submit(() -> {
                    try (Connection connection = connection()) {
                        connection.setAutoCommit(false);
                        update(connection, "SET LOCAL lock_timeout = '5s'");
                        update(connection, """
                            UPDATE sys_group
                            SET is_deleted = TRUE, deleted_at = NOW()
                            WHERE tenant_id = ? AND id = ?
                            """, fixture.tenantId(), fixture.groupId());
                        archivedWithoutCommit.countDown();
                        assertTrue(allowArchiveCommit.await(5, TimeUnit.SECONDS));
                        connection.commit();
                    }
                    return null;
                });

                assertTrue(archivedWithoutCommit.await(5, TimeUnit.SECONDS));
                Future<SQLException> writer = executor.submit(() -> {
                    try (Connection connection = connection()) {
                        connection.setAutoCommit(false);
                        update(connection, "SET LOCAL lock_timeout = '5s'");
                        try {
                            update(connection, """
                                INSERT INTO sys_user
                                    (tenant_id, group_id, username, password, status)
                                VALUES (?, ?, ?, 'hash', 1)
                                """, fixture.tenantId(), fixture.groupId(), unique("writer"));
                            return null;
                        } catch (SQLException exception) {
                            return exception;
                        }
                    }
                });

                allowArchiveCommit.countDown();
                archive.get(5, TimeUnit.SECONDS);
                SQLException failure = writer.get(5, TimeUnit.SECONDS);
                assertSqlFailure(failure, INACTIVE_SQL_STATE, "GROUP_REFERENCE_INACTIVE");
            }
        });
    }

    @Test
    void writerFirstMakesArchiveSeeCommittedReferenceAfterSharedLock() {
        assertTimeoutPreemptively(Duration.ofSeconds(15), () -> {
            executor = Executors.newFixedThreadPool(2);
            CountDownLatch writerInserted = new CountDownLatch(1);
            CountDownLatch allowWriterCommit = new CountDownLatch(1);

            try (Connection setup = connection()) {
                setup.setAutoCommit(false);
                Fixture fixture = fixture(setup, "writer_first");
                setup.commit();

                Future<Void> writer = executor.submit(() -> {
                    try (Connection connection = connection()) {
                        connection.setAutoCommit(false);
                        update(connection, "SET LOCAL lock_timeout = '5s'");
                        update(connection, """
                            INSERT INTO sys_user
                                (tenant_id, group_id, username, password, status)
                            VALUES (?, ?, ?, 'hash', 1)
                            """, fixture.tenantId(), fixture.groupId(), unique("writer"));
                        writerInserted.countDown();
                        assertTrue(allowWriterCommit.await(5, TimeUnit.SECONDS));
                        connection.commit();
                    }
                    return null;
                });

                assertTrue(writerInserted.await(5, TimeUnit.SECONDS));
                Future<Integer> archivePreflight = executor.submit(() -> {
                    try (Connection connection = connection()) {
                        connection.setAutoCommit(false);
                        update(connection, "SET LOCAL lock_timeout = '5s'");
                        try (PreparedStatement statement = connection.prepareStatement("""
                            SELECT id FROM sys_group
                            WHERE tenant_id = ? AND id = ?
                            FOR UPDATE
                            """)) {
                            statement.setString(1, fixture.tenantId());
                            statement.setLong(2, fixture.groupId());
                            statement.executeQuery().close();
                        }
                        int references = queryInt(connection,
                            "SELECT COUNT(*) FROM sys_user WHERE tenant_id = ? AND group_id = ? AND NOT is_deleted",
                            fixture.tenantId(), fixture.groupId());
                        connection.rollback();
                        return references;
                    }
                });

                allowWriterCommit.countDown();
                writer.get(5, TimeUnit.SECONDS);
                assertEquals(1, archivePreflight.get(5, TimeUnit.SECONDS));
            }
        });
    }

    @Test
    void reversedMultiGroupJsonWritesUseStableLockOrderingWithoutDeadlock() {
        assertTimeoutPreemptively(Duration.ofSeconds(15), () -> {
            executor = Executors.newFixedThreadPool(2);
            CountDownLatch start = new CountDownLatch(1);

            try (Connection setup = connection()) {
                setup.setAutoCommit(false);
                Fixture fixture = fixture(setup, "multi_group");
                long secondGroupId = insertGroup(setup, fixture.tenantId(), "business", false, unique("second"));
                setup.commit();

                List<Future<Void>> writes = new ArrayList<>();
                writes.add(executor.submit(() -> insertVisibleGroupsAfter(start, fixture, fixture.groupId(), secondGroupId)));
                writes.add(executor.submit(() -> insertVisibleGroupsAfter(start, fixture, secondGroupId, fixture.groupId())));
                start.countDown();

                for (Future<Void> write : writes) {
                    write.get(10, TimeUnit.SECONDS);
                }
            }
        });
    }

    @Test
    void archiveFirstRejectsOwnerAclAndJsonWritersAfterCommit() {
        List<WriterSelector> selectors = List.of(
            new WriterSelector("owner", cases -> cases.stream()
                .filter(writer -> writer.name().equals("wiki-space-owner")).findFirst().orElseThrow()),
            new WriterSelector("acl", cases -> cases.stream()
                .filter(writer -> writer.name().equals("resource-acl")).findFirst().orElseThrow()),
            new WriterSelector("json", cases -> cases.stream()
                .filter(writer -> writer.name().equals("shared-file-visible-groups")).findFirst().orElseThrow())
        );
        for (WriterSelector selector : selectors) {
            assertArchiveFirstRejectsWriter(selector);
        }
    }

    @Test
    void archiveFirstRejectsEveryScalarAndStructuredWriterAfterCommit() {
        for (String writerName : concurrentWriterNames()) {
            assertArchiveFirstRejectsWriter(selector(writerName));
        }
    }

    @Test
    void ownerAclAndJsonWriterFirstMakesArchiveSeeCommittedReference() {
        List<WriterSelector> selectors = List.of(
            new WriterSelector("owner", cases -> cases.stream()
                .filter(writer -> writer.name().equals("wiki-space-owner")).findFirst().orElseThrow()),
            new WriterSelector("acl", cases -> cases.stream()
                .filter(writer -> writer.name().equals("resource-acl")).findFirst().orElseThrow()),
            new WriterSelector("json", cases -> cases.stream()
                .filter(writer -> writer.name().equals("shared-file-visible-groups")).findFirst().orElseThrow())
        );
        for (WriterSelector selector : selectors) {
            assertWriterFirstVisibleAfterGroupLock(selector);
        }
    }

    @Test
    void everyScalarAndStructuredWriterFirstMakesArchiveSeeCommittedReference() {
        for (String writerName : concurrentWriterNames()) {
            assertWriterFirstVisibleAfterGroupLock(selector(writerName));
        }
    }

    private void assertArchiveFirstRejectsWriter(WriterSelector selector) {
        assertTimeoutPreemptively(Duration.ofSeconds(15), () -> {
            CountDownLatch archivedWithoutCommit = new CountDownLatch(1);
            CountDownLatch allowArchiveCommit = new CountDownLatch(1);
            ExecutorService localExecutor = Executors.newFixedThreadPool(2);
            try (Connection setup = connection()) {
                setup.setAutoCommit(false);
                Fixture fixture = fixture(setup, "archive_first_" + selector.label());
                WriterCase writerCase = selector.select(writerCases(fixture));
                setup.commit();

                Future<Void> archive = localExecutor.submit(() -> {
                    try (Connection connection = connection()) {
                        connection.setAutoCommit(false);
                        update(connection, "SET LOCAL lock_timeout = '5s'");
                        update(connection, "UPDATE sys_group SET is_deleted=TRUE, deleted_at=NOW() "
                            + "WHERE tenant_id=? AND id=?", fixture.tenantId(), fixture.groupId());
                        archivedWithoutCommit.countDown();
                        assertTrue(allowArchiveCommit.await(5, TimeUnit.SECONDS));
                        connection.commit();
                    }
                    return null;
                });
                assertTrue(archivedWithoutCommit.await(5, TimeUnit.SECONDS));
                Future<SQLException> writer = localExecutor.submit(() -> {
                    try (Connection connection = connection(); Statement statement = connection.createStatement()) {
                        connection.setAutoCommit(false);
                        update(connection, "SET LOCAL lock_timeout = '5s'");
                        try {
                            statement.executeUpdate(writerCase.sql());
                            return null;
                        } catch (SQLException exception) {
                            return exception;
                        }
                    }
                });
                allowArchiveCommit.countDown();
                archive.get(5, TimeUnit.SECONDS);
                assertSqlFailure(writer.get(5, TimeUnit.SECONDS), INACTIVE_SQL_STATE,
                    "GROUP_REFERENCE_INACTIVE");
            } finally {
                localExecutor.shutdownNow();
                assertTrue(localExecutor.awaitTermination(5, TimeUnit.SECONDS));
            }
        });
    }

    private void assertWriterFirstVisibleAfterGroupLock(WriterSelector selector) {
        assertTimeoutPreemptively(Duration.ofSeconds(15), () -> {
            CountDownLatch writerInserted = new CountDownLatch(1);
            CountDownLatch allowWriterCommit = new CountDownLatch(1);
            ExecutorService localExecutor = Executors.newFixedThreadPool(2);
            try (Connection setup = connection()) {
                setup.setAutoCommit(false);
                Fixture fixture = fixture(setup, "writer_first_" + selector.label());
                WriterCase writerCase = selector.select(writerCases(fixture));
                setup.commit();

                Future<Void> writer = localExecutor.submit(() -> {
                    try (Connection connection = connection(); Statement statement = connection.createStatement()) {
                        connection.setAutoCommit(false);
                        update(connection, "SET LOCAL lock_timeout = '5s'");
                        statement.executeUpdate(writerCase.sql());
                        writerInserted.countDown();
                        assertTrue(allowWriterCommit.await(5, TimeUnit.SECONDS));
                        connection.commit();
                    }
                    return null;
                });
                assertTrue(writerInserted.await(5, TimeUnit.SECONDS));
                Future<Integer> countAfterLock = localExecutor.submit(() -> {
                    try (Connection connection = connection()) {
                        connection.setAutoCommit(false);
                        update(connection, "SET LOCAL lock_timeout = '5s'");
                        try (PreparedStatement statement = connection.prepareStatement(
                                "SELECT id FROM sys_group WHERE tenant_id=? AND id=? FOR UPDATE")) {
                            statement.setString(1, fixture.tenantId());
                            statement.setLong(2, fixture.groupId());
                            statement.executeQuery().close();
                        }
                        int references = countSelectedReference(connection, selector.label(), fixture);
                        connection.rollback();
                        return references;
                    }
                });
                allowWriterCommit.countDown();
                writer.get(5, TimeUnit.SECONDS);
                assertEquals(1, countAfterLock.get(5, TimeUnit.SECONDS));
            } finally {
                localExecutor.shutdownNow();
                assertTrue(localExecutor.awaitTermination(5, TimeUnit.SECONDS));
            }
        });
    }

    private int countSelectedReference(Connection connection, String label, Fixture fixture)
        throws SQLException {
        return switch (label) {
            case "primary-user" -> queryInt(connection,
                "SELECT COUNT(*) FROM sys_user WHERE tenant_id=? AND group_id=? AND NOT is_deleted",
                fixture.tenantId(), fixture.groupId());
            case "membership" -> queryInt(connection, """
                SELECT COUNT(*) FROM sys_user_group_membership
                WHERE tenant_id=? AND group_id=? AND NOT is_deleted
                """, fixture.tenantId(), fixture.groupId());
            case "role-assignment" -> queryInt(connection, """
                SELECT COUNT(*) FROM sys_role_assignment
                WHERE tenant_id=? AND scope_type='group' AND scope_id=? AND NOT is_deleted
                """, fixture.tenantId(), fixture.groupId());
            case "daily-report" -> queryInt(connection,
                "SELECT COUNT(*) FROM daily_report WHERE tenant_id=? AND group_id=? AND NOT is_deleted",
                fixture.tenantId(), fixture.groupId());
            case "device" -> queryInt(connection,
                "SELECT COUNT(*) FROM device WHERE tenant_id=? AND group_id=? AND NOT is_deleted",
                fixture.tenantId(), fixture.groupId());
            case "device-credential" -> queryInt(connection, """
                SELECT COUNT(*) FROM device_credential
                WHERE tenant_id=? AND group_id=? AND NOT is_deleted
                """, fixture.tenantId(), fixture.groupId());
            case "ops-task" -> queryInt(connection, """
                SELECT COUNT(*) FROM ops_schedule_task
                WHERE tenant_id=? AND group_id=? AND NOT is_deleted
                """, fixture.tenantId(), fixture.groupId());
            case "ops-roster" -> queryInt(connection, """
                SELECT COUNT(*) FROM ops_duty_roster
                WHERE tenant_id=? AND group_id=? AND NOT is_deleted
                """, fixture.tenantId(), fixture.groupId());
            case "wiki-space-owner" -> queryInt(connection,
                "SELECT COUNT(*) FROM wiki_space WHERE tenant_id=? AND owner_group_id=? AND NOT is_deleted",
                fixture.tenantId(), fixture.groupId());
            case "wiki-page-owner" -> queryInt(connection,
                "SELECT COUNT(*) FROM wiki_page WHERE tenant_id=? AND owner_group_id=? AND NOT is_deleted",
                fixture.tenantId(), fixture.groupId());
            case "shared-folder-owner" -> queryInt(connection, """
                SELECT COUNT(*) FROM shared_folder
                WHERE tenant_id=? AND owner_group_id=? AND NOT is_deleted
                """, fixture.tenantId(), fixture.groupId());
            case "shared-file-owner" -> queryInt(connection,
                "SELECT COUNT(*) FROM shared_file WHERE tenant_id=? AND owner_group_id=? AND NOT is_deleted",
                fixture.tenantId(), fixture.groupId());
            case "resource-acl" -> queryInt(connection, """
                SELECT COUNT(*) FROM resource_acl_entry
                WHERE tenant_id=? AND subject_type='group' AND subject_id=? AND NOT is_deleted
                """, fixture.tenantId(), fixture.groupId());
            case "wiki-page-acl" -> queryInt(connection, """
                SELECT COUNT(*) FROM wiki_page_acl
                WHERE tenant_id=? AND subject_type='group' AND subject_id=? AND NOT is_deleted
                """, fixture.tenantId(), fixture.groupId());
            case "wiki-space-acl" -> queryInt(connection, """
                SELECT COUNT(*) FROM wiki_space_acl
                WHERE tenant_id=? AND subject_type='group' AND subject_id=? AND NOT is_deleted
                """, fixture.tenantId(), fixture.groupId());
            case "shared-folder-acl" -> queryInt(connection, """
                SELECT COUNT(*) FROM shared_folder_acl
                WHERE tenant_id=? AND subject_type='group' AND subject_id=? AND NOT is_deleted
                """, fixture.tenantId(), fixture.groupId());
            case "owner" -> queryInt(connection,
                "SELECT COUNT(*) FROM wiki_space WHERE tenant_id=? AND owner_group_id=? AND NOT is_deleted",
                fixture.tenantId(), fixture.groupId());
            case "acl" -> queryInt(connection, """
                SELECT COUNT(*) FROM resource_acl_entry
                WHERE tenant_id=? AND subject_type='group' AND subject_id=? AND NOT is_deleted
                """, fixture.tenantId(), fixture.groupId());
            case "json" -> queryInt(connection, """
                SELECT COUNT(*) FROM shared_file file
                WHERE file.tenant_id=? AND NOT file.is_deleted
                  AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements(file.visible_groups) value
                    WHERE parse_group_reference_id(value)=?
                  )
                """, fixture.tenantId(), fixture.groupId());
            case "shared-file-visible-groups" -> queryInt(connection, """
                SELECT COUNT(*) FROM shared_file file
                WHERE file.tenant_id=? AND NOT file.is_deleted
                  AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements(file.visible_groups) value
                    WHERE parse_group_reference_id(value)=?
                  )
                """, fixture.tenantId(), fixture.groupId());
            case "ops-assignee-rule", "ops-recipient-rule", "ops-escalation-rule" -> queryInt(connection, """
                SELECT COUNT(*) FROM ops_schedule_rule rule
                WHERE rule.tenant_id=? AND rule.enabled AND NOT rule.is_deleted
                  AND EXISTS (
                    SELECT 1 FROM jsonb_path_query(
                      jsonb_build_array(
                        COALESCE(NULLIF(BTRIM(rule.assignee_rule),''),'{}')::jsonb,
                        COALESCE(NULLIF(BTRIM(rule.recipient_rule),''),'{}')::jsonb,
                        COALESCE(NULLIF(BTRIM(rule.escalation_rule),''),'{}')::jsonb
                      ), 'strict $.**.groupId') reference(value)
                    WHERE parse_group_reference_id(reference.value)=?
                  )
                """, fixture.tenantId(), fixture.groupId());
            default -> throw new IllegalArgumentException("Unknown writer selector: " + label);
        };
    }

    private static WriterSelector selector(String writerName) {
        return new WriterSelector(writerName, cases -> cases.stream()
            .filter(writer -> writer.name().equals(writerName)).findFirst().orElseThrow());
    }

    private static List<String> concurrentWriterNames() {
        return List.of(
            "primary-user", "membership", "role-assignment", "daily-report", "device",
            "device-credential", "ops-task", "ops-roster", "wiki-space-owner", "wiki-page-owner",
            "shared-folder-owner", "shared-file-owner", "resource-acl", "wiki-page-acl",
            "wiki-space-acl", "shared-folder-acl", "shared-file-visible-groups",
            "ops-assignee-rule", "ops-recipient-rule", "ops-escalation-rule"
        );
    }

    private Void insertVisibleGroupsAfter(CountDownLatch start, Fixture fixture,
                                          long firstGroupId, long secondGroupId) throws Exception {
        assertTrue(start.await(5, TimeUnit.SECONDS));
        try (Connection connection = connection()) {
            connection.setAutoCommit(false);
            update(connection, "SET LOCAL lock_timeout = '5s'");
            update(connection, """
                INSERT INTO shared_file
                    (tenant_id, folder_id, name, original_name, file_type, size_bytes, minio_key,
                     visible_groups, created_by)
                VALUES (?, ?, ?, ?, 'txt', 1, ?, jsonb_build_array(?::BIGINT, ?::BIGINT), 0)
                """, fixture.tenantId(), fixture.folderId(), unique("multi"), "multi.txt",
                unique("minio"), firstGroupId, secondGroupId);
            connection.commit();
        }
        return null;
    }

    private static Flyway flyway(MigrationVersion target) {
        return Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .validateOnMigrate(false)
            .target(target)
            .load();
    }

    private static String groupSnapshot() throws SQLException {
        try (Connection connection = connection();
             Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("""
                 SELECT COALESCE(string_agg(
                     concat_ws('|', id, tenant_id, code, name, group_type, is_builtin, is_deleted,
                               COALESCE(leader_id::TEXT, ''), updated_at::TEXT),
                     ',' ORDER BY id
                 ), '')
                 FROM sys_group
                 """)) {
            result.next();
            return result.getString(1);
        }
    }

    private static Connection connection() throws SQLException {
        return DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    private static Fixture fixture(Connection connection, String label) throws SQLException {
        String tenantId = unique("tenant_" + label);
        long groupId = insertGroup(connection, tenantId, "business", false, unique("group"));
        long userId = insertId(connection, """
            INSERT INTO sys_user (tenant_id, username, password, status)
            VALUES (?, ?, 'hash', 1) RETURNING id
            """, tenantId, unique("user"));
        long roleId = insertId(connection, """
            INSERT INTO sys_role
                (tenant_id, name, code, scope, role_type, is_builtin, is_legacy)
            VALUES (?, ?, ?, 'group', 'functional', FALSE, FALSE) RETURNING id
            """, tenantId, unique("role-name"), unique("role-code"));
        long deviceId = insertId(connection, """
            INSERT INTO device (tenant_id, name, device_type)
            VALUES (?, ?, 'server') RETURNING id
            """, tenantId, unique("device"));
        long wikiSpaceId = insertId(connection, """
            INSERT INTO wiki_space (tenant_id, name) VALUES (?, ?) RETURNING id
            """, tenantId, unique("space"));
        long wikiPageId = insertId(connection, """
            INSERT INTO wiki_page (tenant_id, space_id, slug, title, content)
            VALUES (?, ?, ?, ?, '') RETURNING id
            """, tenantId, wikiSpaceId, unique("slug"), unique("title"));
        long folderId = insertId(connection, """
            INSERT INTO shared_folder (tenant_id, name, created_by)
            VALUES (?, ?, 0) RETURNING id
            """, tenantId, unique("folder"));
        return new Fixture(tenantId, groupId, userId, roleId, deviceId, wikiSpaceId, wikiPageId, folderId);
    }

    private static List<WriterCase> writerCases(Fixture fixture) {
        String tenant = literal(fixture.tenantId());
        long group = fixture.groupId();
        return List.of(
            new WriterCase("primary-user", """
                INSERT INTO sys_user (tenant_id, group_id, username, password, status)
                VALUES (%s, %d, %s, 'hash', 1)
                """.formatted(tenant, group, literal(unique("primary")))),
            new WriterCase("membership", """
                INSERT INTO sys_user_group_membership
                    (tenant_id, user_id, group_id, membership_role, origin_type)
                VALUES (%s, %d, %d, 'member', 'manual')
                """.formatted(tenant, fixture.userId(), group)),
            new WriterCase("role-assignment", """
                INSERT INTO sys_role_assignment
                    (tenant_id, user_id, role_id, scope_type, scope_id, origin_type)
                VALUES (%s, %d, %d, 'group', %d, 'manual')
                """.formatted(tenant, fixture.userId(), fixture.roleId(), group)),
            new WriterCase("daily-report", """
                INSERT INTO daily_report
                    (tenant_id, group_id, reporter_id, report_date, completed_items, tomorrow_plan, status)
                VALUES (%s, %d, %d, CURRENT_DATE, 'done', 'next', 'DRAFT')
                """.formatted(tenant, group, fixture.userId())),
            new WriterCase("device", """
                INSERT INTO device (tenant_id, group_id, name, device_type)
                VALUES (%s, %d, %s, 'server')
                """.formatted(tenant, group, literal(unique("device-ref")))),
            new WriterCase("ip-pool", """
                INSERT INTO ip_pool
                    (tenant_id, group_id, name, cidr, status, total_count, allocated_count)
                VALUES (%s, %d, %s, '10.254.0.0/30', 'active', 2, 0)
                """.formatted(tenant, group, literal(unique("ip-pool-ref")))),
            new WriterCase("device-credential", """
                INSERT INTO device_credential
                    (tenant_id, device_id, group_id, username, password_enc)
                VALUES (%s, %d, %d, 'operator', 'encrypted')
                """.formatted(tenant, fixture.deviceId(), group)),
            new WriterCase("ops-task", """
                INSERT INTO ops_schedule_task
                    (tenant_id, title, task_type, source_type, status, group_id)
                VALUES (%s, %s, 'inspection', 'manual', 'not_started', %d)
                """.formatted(tenant, literal(unique("task")), group)),
            new WriterCase("ops-roster", """
                INSERT INTO ops_duty_roster
                    (tenant_id, duty_date, shift_name, assignee_id, group_id)
                VALUES (%s, CURRENT_DATE, 'day', %d, %d)
                """.formatted(tenant, fixture.userId(), group)),
            new WriterCase("wiki-space-owner", """
                INSERT INTO wiki_space (tenant_id, name, owner_group_id)
                VALUES (%s, %s, %d)
                """.formatted(tenant, literal(unique("owned-space")), group)),
            new WriterCase("wiki-page-owner", """
                INSERT INTO wiki_page
                    (tenant_id, space_id, slug, title, content, owner_group_id)
                VALUES (%s, %d, %s, %s, '', %d)
                """.formatted(tenant, fixture.wikiSpaceId(), literal(unique("owned-slug")),
                    literal(unique("owned-title")), group)),
            new WriterCase("shared-folder-owner", """
                INSERT INTO shared_folder (tenant_id, name, created_by, owner_group_id)
                VALUES (%s, %s, 0, %d)
                """.formatted(tenant, literal(unique("owned-folder")), group)),
            new WriterCase("shared-file-owner", sharedFileSql(fixture, "'[]'::JSONB", group)),
            new WriterCase("resource-acl", """
                INSERT INTO resource_acl_entry
                    (tenant_id, resource_type, resource_id, entry_type, subject_type, subject_id, permissions)
                VALUES (%s, 'wiki_space', %d, 'access', 'group', %d, 4)
                """.formatted(tenant, fixture.wikiSpaceId(), group)),
            new WriterCase("wiki-page-acl", """
                INSERT INTO wiki_page_acl
                    (tenant_id, page_id, subject_type, subject_id, permissions)
                VALUES (%s, %d, 'group', %d, '["read"]')
                """.formatted(tenant, fixture.wikiPageId(), group)),
            new WriterCase("wiki-space-acl", """
                INSERT INTO wiki_space_acl
                    (tenant_id, space_id, subject_type, subject_id, permissions)
                VALUES (%s, %d, 'group', %d, '["update"]')
                """.formatted(tenant, fixture.wikiSpaceId(), group)),
            new WriterCase("shared-folder-acl", """
                INSERT INTO shared_folder_acl
                    (tenant_id, folder_id, subject_type, subject_id, permissions)
                VALUES (%s, %d, 'group', %d, '["read"]')
                """.formatted(tenant, fixture.folderId(), group)),
            new WriterCase("shared-file-visible-groups",
                sharedFileSql(fixture, "jsonb_build_array(%d::BIGINT, %s)".formatted(group,
                    literal(Long.toString(group))), null)),
            new WriterCase("ops-assignee-rule", opsRuleSql(fixture,
                "{\"type\":\"group_leader\",\"groupId\":%d}".formatted(group), "{}", "{}")),
            new WriterCase("ops-recipient-rule", opsRuleSql(fixture, "{}",
                "{\"nested\":{\"groupId\":\"%d\"}}".formatted(group), "{}")),
            new WriterCase("ops-escalation-rule", opsRuleSql(fixture, "{}", "{}",
                "{\"targets\":[{\"groupId\":%d}]}".formatted(group)))
        );
    }

    private static String sharedFileSql(Fixture fixture, String visibleGroupsExpression, Long ownerGroupId) {
        return """
            INSERT INTO shared_file
                (tenant_id, folder_id, name, original_name, file_type, size_bytes, minio_key,
                 visible_groups, owner_group_id, created_by)
            VALUES (%s, %d, %s, 'file.txt', 'txt', 1, %s, %s, %s, 0)
            """.formatted(literal(fixture.tenantId()), fixture.folderId(), literal(unique("file")),
                literal(unique("minio")), visibleGroupsExpression,
                ownerGroupId == null ? "NULL" : Long.toString(ownerGroupId));
    }

    private static String opsRuleSql(Fixture fixture, String assignee, String recipient, String escalation) {
        return """
            INSERT INTO ops_schedule_rule
                (tenant_id, name, task_type, trigger_type, assignee_rule, recipient_rule, escalation_rule)
            VALUES (%s, %s, 'inspection', 'daily', %s, %s, %s)
            """.formatted(literal(fixture.tenantId()), literal(unique("rule")), literal(assignee),
                literal(recipient), literal(escalation));
    }

    private static void assertHelperFailure(Connection connection, String tenantId, long groupId)
        throws SQLException {
        Savepoint savepoint = connection.setSavepoint();
        SQLException failure = assertThrows(SQLException.class,
            () -> update(connection, "SELECT require_active_business_group(?, ?)", tenantId, groupId));
        assertSqlFailure(failure, INACTIVE_SQL_STATE, "GROUP_REFERENCE_INACTIVE");
        connection.rollback(savepoint);
    }

    private static void assertInvalidJsonFailure(Connection connection, Fixture fixture,
                                                 String visibleGroupsExpression) throws SQLException {
        Savepoint savepoint = connection.setSavepoint();
        SQLException failure = assertThrows(SQLException.class, () -> {
            try (Statement statement = connection.createStatement()) {
                statement.executeUpdate(sharedFileSql(fixture, visibleGroupsExpression, null));
            }
        });
        assertSqlFailure(failure, INVALID_SQL_STATE, "GROUP_REFERENCE_INVALID");
        connection.rollback(savepoint);
    }

    private static void assertInvalidOpsRuleFailure(Connection connection, Fixture fixture, String invalidJson)
        throws SQLException {
        Savepoint savepoint = connection.setSavepoint();
        SQLException failure = assertThrows(SQLException.class, () -> {
            try (Statement statement = connection.createStatement()) {
                statement.executeUpdate(opsRuleSql(fixture, invalidJson, "{}", "{}"));
            }
        });
        assertSqlFailure(failure, INVALID_SQL_STATE, "GROUP_REFERENCE_INVALID");
        connection.rollback(savepoint);
    }

    private static void assertSqlFailure(SQLException failure, String sqlState, String message) {
        assertEquals(sqlState, failure.getSQLState());
        assertTrue(failure.getMessage().contains(message), failure.getMessage());
    }

    private static long insertGroup(Connection connection, String tenantId, String groupType,
                                    boolean builtin, String code) throws SQLException {
        return insertId(connection, """
            INSERT INTO sys_group
                (tenant_id, code, name, group_type, is_builtin)
            VALUES (?, ?, ?, ?, ?) RETURNING id
            """, tenantId, code, unique("group-name"), groupType, builtin);
    }

    private static long insertId(Connection connection, String sql, Object... parameters) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, parameters);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next());
                return result.getLong(1);
            }
        }
    }

    private static int update(Connection connection, String sql, Object... parameters) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, parameters);
            return statement.executeUpdate();
        }
    }

    private static int queryInt(Connection connection, String sql, Object... parameters) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, parameters);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next());
                return result.getInt(1);
            }
        }
    }

    private static boolean queryBoolean(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement(); ResultSet result = statement.executeQuery(sql)) {
            assertTrue(result.next());
            return result.getBoolean(1);
        }
    }

    private static void bind(PreparedStatement statement, Object... parameters) throws SQLException {
        for (int index = 0; index < parameters.length; index++) {
            statement.setObject(index + 1, parameters[index]);
        }
    }

    private static String unique(String prefix) {
        return prefix + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    private static String literal(String value) {
        return "'" + value.replace("'", "''") + "'";
    }

    private record Fixture(
        String tenantId,
        long groupId,
        long userId,
        long roleId,
        long deviceId,
        long wikiSpaceId,
        long wikiPageId,
        long folderId
    ) {}

    private record WriterCase(String name, String sql) {}

    private record WriterSelector(String label,
                                  java.util.function.Function<List<WriterCase>, WriterCase> selector) {
        WriterCase select(List<WriterCase> cases) {
            return selector.apply(cases);
        }
    }
}
