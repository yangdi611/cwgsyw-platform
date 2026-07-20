package com.cwgsyw.platform.module.org;

import com.cwgsyw.platform.config.MyBatisPlusConfig;
import com.cwgsyw.platform.module.authorization.AuthorizationModeService;
import com.cwgsyw.platform.module.org.GroupReferenceRegistry.Disposition;
import com.cwgsyw.platform.module.org.GroupReferenceRegistry.ReferenceDescriptor;
import com.cwgsyw.platform.module.org.dto.GroupLifecycleActionRequest;
import com.cwgsyw.platform.module.org.dto.GroupLifecycleBlocker;
import com.cwgsyw.platform.module.org.dto.GroupLifecyclePreflightVO;
import com.cwgsyw.platform.module.rbac.RoleAssignmentService;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest(
    classes = GroupLifecycleBlockerIntegrationTest.TestApplication.class,
    properties = {
        "spring.main.web-application-type=none",
        "spring.flyway.enabled=true",
        "spring.flyway.validate-on-migrate=false",
        "group.lifecycle.purge-retention-days=0",
        "flowable.database-schema-update=create-drop",
        "flowable.async-executor-activate=false"
    }
)
@Testcontainers
class GroupLifecycleBlockerIntegrationTest {
    private static final Set<String> ARCHIVE_BLOCKER_TYPES = Set.of(
        "leaders",
        "primaryUsers",
        "memberships",
        "roleAssignments",
        "openDailyReports",
        "devices",
        "ipPools",
        "deviceCredentials",
        "openOpsTasks",
        "currentFutureRosters",
        "enabledOpsRules",
        "runningWorkflowLinks",
        "runningWorkflowVariables",
        "flowableIdentityMemberships",
        "flowablePrivilegeMappings",
        "wikiSpaceOwners",
        "wikiPageOwners",
        "sharedFolderOwners",
        "sharedFileOwners",
        "resourceAcls",
        "wikiPageAcls",
        "wikiSpaceAcls",
        "sharedFolderAcls",
        "sharedFileVisibleGroups"
    );

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
        .withDatabaseName("cwgsyw_group_blocker_it")
        .withUsername("fqa")
        .withPassword("fqa");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired GroupReferenceInventoryService inventoryService;
    @Autowired GroupLifecycleService lifecycleService;

    @MockBean AuthorizationModeService authorizationModeService;
    @MockBean RoleAssignmentService roleAssignmentService;

    @TestFactory
    Stream<DynamicTest> everyActiveReferenceBlocksArchiveWithoutMutation() {
        when(authorizationModeService.effectiveMode(anyString()))
            .thenReturn(AuthorizationModeService.EffectiveMode.LEGACY);

        List<ReferenceDescriptor> descriptors = GroupReferenceRegistry.descriptors().stream()
            .filter(descriptor -> descriptor.archiveDisposition() == Disposition.BLOCKER)
            .toList();
        assertEquals(ARCHIVE_BLOCKER_TYPES, descriptors.stream()
            .map(ReferenceDescriptor::referenceType)
            .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));

        return descriptors.stream().map(descriptor -> DynamicTest.dynamicTest(
            descriptor.referenceType(), () -> assertBlockedArchiveContract(descriptor)));
    }

    @TestFactory
    Stream<DynamicTest> everyRegisteredReferenceBlocksPurgeWithoutMutation() {
        when(authorizationModeService.effectiveMode(anyString()))
            .thenReturn(AuthorizationModeService.EffectiveMode.LEGACY);
        return GroupReferenceRegistry.descriptors().stream().map(descriptor -> DynamicTest.dynamicTest(
            "purge-" + descriptor.referenceType(), () -> assertBlockedPurgeContract(descriptor)));
    }

    private void assertBlockedArchiveContract(ReferenceDescriptor descriptor) {
        Fixture fixture = fixture(descriptor.referenceType());
        insertReference(descriptor.referenceType(), fixture);

        GroupReferenceInventoryService.ReferenceSnapshot beforeInventory =
            inventoryService.snapshotForArchive(fixture.tenantId(), fixture.groupId());
        GroupRow beforeGroup = groupRow(fixture);
        long beforeReferenceCount = beforeInventory.activeCounts().get(descriptor.referenceType());
        long beforeAuditCount = lifecycleAuditCount(fixture);

        assertEquals(1L, beforeReferenceCount, descriptor.referenceType());
        assertEquals(ARCHIVE_BLOCKER_TYPES, beforeInventory.activeCounts().keySet());
        assertEquals(1, beforeInventory.blockers().size(), beforeInventory.blockers().toString());
        assertStableBlocker(descriptor, beforeInventory.blockers().getFirst());

        GroupLifecycleActionRequest request = new GroupLifecycleActionRequest();
        request.setReason("REM-P1-001 AC-004/005 blocked archive proof");
        request.setConfirmationName(fixture.groupName());
        request.setExpectedUpdatedAt(beforeGroup.updatedAt());
        SecurityUser operator = new SecurityUser(
            fixture.userId(), "fqa-blocker-operator", "", fixture.tenantId(), null,
            "tenant", Set.of("group:delete"));

        GroupLifecycleException failure = assertThrows(GroupLifecycleException.class,
            () -> lifecycleService.archive(fixture.groupId(), request, operator));
        assertEquals(409, failure.getHttpStatus());
        assertEquals("GROUP_ARCHIVE_BLOCKED_REFERENCES", failure.getErrorCode());
        GroupLifecyclePreflightVO failedPreflight = failure.getPreflight();
        assertNotNull(failedPreflight);
        assertFalse(failedPreflight.eligible());
        assertEquals(1L, failedPreflight.activeCounts().get(descriptor.referenceType()));
        assertEquals(1, failedPreflight.blockers().size(), failedPreflight.blockers().toString());
        assertStableBlocker(descriptor, failedPreflight.blockers().getFirst());

        GroupReferenceInventoryService.ReferenceSnapshot afterInventory =
            inventoryService.snapshotForArchive(fixture.tenantId(), fixture.groupId());
        assertEquals(beforeGroup, groupRow(fixture), "blocked archive changed group row");
        assertEquals(beforeReferenceCount,
            afterInventory.activeCounts().get(descriptor.referenceType()),
            "blocked archive changed reference count");
        assertEquals(beforeAuditCount, lifecycleAuditCount(fixture),
            "blocked archive wrote lifecycle audit");
        assertTrue(afterInventory.blockers().stream()
            .anyMatch(blocker -> descriptor.referenceType().equals(blocker.referenceType())));
    }

    private void assertStableBlocker(ReferenceDescriptor descriptor, GroupLifecycleBlocker blocker) {
        assertEquals(descriptor.referenceType(), blocker.referenceType());
        assertEquals(1L, blocker.count());
        assertEquals(descriptor.archiveReasonCode(), blocker.reasonCode());
        assertEquals(descriptor.resolution(), blocker.resolution());
        assertFalse(blocker.resolution().isBlank());
        assertEquals(descriptor.messageTemplate().replace("{count}", "1"), blocker.message());
    }

    private void assertBlockedPurgeContract(ReferenceDescriptor descriptor) {
        Fixture fixture = fixture("purge_" + descriptor.referenceType());
        insertReference(descriptor.referenceType(), fixture);
        update("""
            UPDATE sys_group
            SET is_deleted=TRUE, deleted_at=NOW(), deleted_by=?, updated_at=NOW(), updated_by=?
            WHERE tenant_id=? AND id=?
            """, fixture.userId(), fixture.userId(), fixture.tenantId(), fixture.groupId());

        GroupReferenceInventoryService.ReferenceSnapshot beforeInventory =
            inventoryService.snapshotForPurge(fixture.tenantId(), fixture.groupId());
        GroupRow beforeGroup = groupRow(fixture);
        long beforeAuditCount = lifecycleAuditCount(fixture);
        assertEquals(1L, beforeInventory.historicalCounts().get(descriptor.referenceType()));
        GroupLifecycleBlocker blocker = beforeInventory.blockers().stream()
            .filter(item -> descriptor.referenceType().equals(item.referenceType()))
            .findFirst().orElseThrow();
        assertEquals(descriptor.purgeReasonCode(), blocker.reasonCode());
        assertEquals(1L, blocker.count());
        assertFalse(blocker.resolution().isBlank());

        GroupLifecycleActionRequest request = new GroupLifecycleActionRequest();
        request.setReason("REM-P1-001 AC-015 blocked purge proof");
        request.setConfirmationName(fixture.groupName());
        request.setExpectedUpdatedAt(beforeGroup.updatedAt());
        request.setExpectedArchivedAt(beforeGroup.deletedAt());
        SecurityUser operator = new SecurityUser(
            fixture.userId(), "fqa-purge-operator", "", fixture.tenantId(), null,
            "platform", Set.of("group:purge"));

        GroupLifecycleException failure = assertThrows(GroupLifecycleException.class,
            () -> lifecycleService.purge(fixture.groupId(), request, operator));
        assertEquals(409, failure.getHttpStatus());
        assertEquals("GROUP_PURGE_BLOCKED_REFERENCES", failure.getErrorCode());
        assertEquals(beforeGroup, groupRow(fixture), "blocked purge changed group row");
        assertEquals(beforeAuditCount, lifecycleAuditCount(fixture),
            "blocked purge wrote lifecycle audit");
    }

    private Fixture fixture(String label) {
        String suffix = shortId();
        String tenantId = "fqa_blocker_" + label + "_" + suffix;
        String groupName = "FQA blocker " + label + " " + suffix;
        long groupId = id("""
            INSERT INTO sys_group (tenant_id, code, name, group_type, is_builtin)
            VALUES (?, ?, ?, 'business', FALSE) RETURNING id
            """, tenantId, "fqa_" + label + "_" + suffix, groupName);
        long userId = id("""
            INSERT INTO sys_user (tenant_id, username, password, status)
            VALUES (?, ?, 'hash', 1) RETURNING id
            """, tenantId, "fqa_user_" + suffix);
        long roleId = id("""
            INSERT INTO sys_role
                (tenant_id, name, code, scope, role_type, is_builtin, is_legacy)
            VALUES (?, ?, ?, 'group', 'functional', FALSE, FALSE) RETURNING id
            """, tenantId, "FQA role " + suffix, "fqa_role_" + suffix);
        long deviceId = id("""
            INSERT INTO device (tenant_id, name, device_type)
            VALUES (?, ?, 'server') RETURNING id
            """, tenantId, "FQA device " + suffix);
        long wikiSpaceId = id("""
            INSERT INTO wiki_space (tenant_id, name) VALUES (?, ?) RETURNING id
            """, tenantId, "FQA space " + suffix);
        long wikiPageId = id("""
            INSERT INTO wiki_page (tenant_id, space_id, slug, title, content)
            VALUES (?, ?, ?, ?, '') RETURNING id
            """, tenantId, wikiSpaceId, "fqa-page-" + suffix, "FQA page " + suffix);
        String folderName = "FQA folder " + suffix;
        long folderId = id("""
            INSERT INTO shared_folder (tenant_id, name, normalized_name, created_by)
            VALUES (?, ?, lower(btrim(?)), 0) RETURNING id
            """, tenantId, folderName, folderName);
        return new Fixture(tenantId, groupId, groupName, userId, roleId, deviceId,
            wikiSpaceId, wikiPageId, folderId, suffix);
    }

    private void insertReference(String referenceType, Fixture fixture) {
        switch (referenceType) {
            case "leaders" -> update("UPDATE sys_group SET leader_id=? WHERE id=?",
                fixture.userId(), fixture.groupId());
            case "primaryUsers" -> update("UPDATE sys_user SET group_id=? WHERE id=?",
                fixture.groupId(), fixture.userId());
            case "memberships" -> update("""
                INSERT INTO sys_user_group_membership
                    (tenant_id, user_id, group_id, membership_role, origin_type)
                VALUES (?, ?, ?, 'member', 'manual')
                """, fixture.tenantId(), fixture.userId(), fixture.groupId());
            case "roleAssignments" -> update("""
                INSERT INTO sys_role_assignment
                    (tenant_id, user_id, role_id, scope_type, scope_id, origin_type)
                VALUES (?, ?, ?, 'group', ?, 'manual')
                """, fixture.tenantId(), fixture.userId(), fixture.roleId(), fixture.groupId());
            case "openDailyReports" -> update("""
                INSERT INTO daily_report
                    (tenant_id, group_id, reporter_id, report_date, completed_items, tomorrow_plan, status)
                VALUES (?, ?, ?, CURRENT_DATE, 'done', 'next', 'DRAFT')
                """, fixture.tenantId(), fixture.groupId(), fixture.userId());
            case "devices" -> update("""
                INSERT INTO device (tenant_id, group_id, name, device_type)
                VALUES (?, ?, ?, 'server')
                """, fixture.tenantId(), fixture.groupId(), "FQA grouped device " + fixture.suffix());
            case "ipPools" -> update("""
                INSERT INTO ip_pool
                    (tenant_id, group_id, name, cidr, status, total_count, allocated_count)
                VALUES (?, ?, ?, '10.254.0.0/30', 'active', 2, 0)
                """, fixture.tenantId(), fixture.groupId(), "FQA IP pool " + fixture.suffix());
            case "deviceCredentials" -> update("""
                INSERT INTO device_credential
                    (tenant_id, device_id, group_id, username, password_enc)
                VALUES (?, ?, ?, 'operator', 'encrypted')
                """, fixture.tenantId(), fixture.deviceId(), fixture.groupId());
            case "openOpsTasks" -> update("""
                INSERT INTO ops_schedule_task
                    (tenant_id, title, task_type, source_type, status, group_id)
                VALUES (?, ?, 'inspection', 'manual', 'not_started', ?)
                """, fixture.tenantId(), "FQA task " + fixture.suffix(), fixture.groupId());
            case "currentFutureRosters" -> update("""
                INSERT INTO ops_duty_roster
                    (tenant_id, duty_date, shift_name, assignee_id, group_id)
                VALUES (?, CURRENT_DATE, 'day', ?, ?)
                """, fixture.tenantId(), fixture.userId(), fixture.groupId());
            case "enabledOpsRules" -> update("""
                INSERT INTO ops_schedule_rule
                    (tenant_id, name, task_type, trigger_type, assignee_rule, recipient_rule, escalation_rule)
                VALUES (?, ?, 'inspection', 'daily', ?, '{}', '{}')
                """, fixture.tenantId(), "FQA rule " + fixture.suffix(),
                "{\"nested\":{\"groupId\":\"" + fixture.groupId() + "\"}}");
            case "runningWorkflowLinks" -> update("""
                INSERT INTO act_ru_identitylink (id_, rev_, group_id_, type_)
                VALUES (?, 1, ?, 'candidate')
                """, "fqa_link_" + fixture.suffix(), "group_" + fixture.groupId());
            case "runningWorkflowVariables" -> update("""
                INSERT INTO act_ru_variable (id_, rev_, type_, name_, text_)
                VALUES (?, 1, 'string', 'submitterGroupToken', ?)
                """, "fqa_var_" + fixture.suffix(), "group_" + fixture.groupId());
            case "flowableIdentityMemberships" -> insertFlowableMembership(fixture);
            case "flowablePrivilegeMappings" -> insertFlowablePrivilege(fixture);
            case "wikiSpaceOwners" -> update("UPDATE wiki_space SET owner_group_id=? WHERE id=?",
                fixture.groupId(), fixture.wikiSpaceId());
            case "wikiPageOwners" -> update("UPDATE wiki_page SET owner_group_id=? WHERE id=?",
                fixture.groupId(), fixture.wikiPageId());
            case "sharedFolderOwners" -> update("UPDATE shared_folder SET owner_group_id=? WHERE id=?",
                fixture.groupId(), fixture.folderId());
            case "sharedFileOwners" -> insertSharedFile(fixture, fixture.groupId(), "[]");
            case "resourceAcls" -> update("""
                INSERT INTO resource_acl_entry
                    (tenant_id, resource_type, resource_id, entry_type, subject_type, subject_id, permissions)
                VALUES (?, 'wiki_space', ?, 'access', 'group', ?, 4)
                """, fixture.tenantId(), fixture.wikiSpaceId(), fixture.groupId());
            case "wikiPageAcls" -> update("""
                INSERT INTO wiki_page_acl
                    (tenant_id, page_id, subject_type, subject_id, permissions)
                VALUES (?, ?, 'group', ?, '[\"read\"]')
                """, fixture.tenantId(), fixture.wikiPageId(), fixture.groupId());
            case "wikiSpaceAcls" -> update("""
                INSERT INTO wiki_space_acl
                    (tenant_id, space_id, subject_type, subject_id, permissions)
                VALUES (?, ?, 'group', ?, '[\"update\"]')
                """, fixture.tenantId(), fixture.wikiSpaceId(), fixture.groupId());
            case "sharedFolderAcls" -> update("""
                INSERT INTO shared_folder_acl
                    (tenant_id, folder_id, subject_type, subject_id, permissions)
                VALUES (?, ?, 'group', ?, '[\"read\"]')
                """, fixture.tenantId(), fixture.folderId(), fixture.groupId());
            case "sharedFileVisibleGroups" ->
                insertSharedFile(fixture, null, "[\"" + fixture.groupId() + "\"]");
            case "workflowHistoryLinks" -> update("""
                INSERT INTO act_hi_identitylink (id_, group_id_, type_)
                VALUES (?, ?, 'candidate')
                """, "fqa_hi_link_" + fixture.suffix(), "group_" + fixture.groupId());
            case "workflowHistoryVariables" -> update("""
                INSERT INTO act_hi_varinst
                    (id_, name_, var_type_, text_, create_time_, last_updated_time_)
                VALUES (?, 'submitterGroupToken', 'string', ?, NOW(), NOW())
                """, "fqa_hi_var_" + fixture.suffix(), "group_" + fixture.groupId());
            case "workflowHistoryDetails" -> update("""
                INSERT INTO act_hi_detail
                    (id_, type_, name_, var_type_, time_, text_)
                VALUES (?, 'VariableUpdate', 'groupId', 'string', NOW(), ?)
                """, "fqa_hi_detail_" + fixture.suffix(), String.valueOf(fixture.groupId()));
            default -> throw new IllegalArgumentException("Missing blocker fixture: " + referenceType);
        }
    }

    private void insertFlowableMembership(Fixture fixture) {
        String userToken = "fqa_user_" + fixture.suffix();
        String groupToken = "group_" + fixture.groupId();
        update("INSERT INTO act_id_user (id_, rev_) VALUES (?, 1)", userToken);
        update("INSERT INTO act_id_group (id_, rev_, name_, type_) VALUES (?, 1, ?, 'assignment')",
            groupToken, groupToken);
        update("INSERT INTO act_id_membership (user_id_, group_id_) VALUES (?, ?)",
            userToken, groupToken);
    }

    private void insertFlowablePrivilege(Fixture fixture) {
        String privilegeId = "fqa_priv_" + fixture.suffix();
        String privilegeName = "FQA privilege " + fixture.suffix();
        update("INSERT INTO act_id_priv (id_, name_) VALUES (?, ?)", privilegeId, privilegeName);
        update("""
            INSERT INTO act_id_priv_mapping (id_, priv_id_, group_id_)
            VALUES (?, ?, ?)
            """, "fqa_mapping_" + fixture.suffix(), privilegeId, "group_" + fixture.groupId());
    }

    private void insertSharedFile(Fixture fixture, Long ownerGroupId, String visibleGroups) {
        update("""
            INSERT INTO shared_file
                (tenant_id, folder_id, name, original_name, file_type, size_bytes, minio_key,
                 visible_groups, owner_group_id, created_by)
            VALUES (?, ?, ?, 'file.txt', 'txt', 1, ?, ?::jsonb, ?, 0)
            """, fixture.tenantId(), fixture.folderId(), "FQA file " + fixture.suffix(),
            "fqa/minio/" + fixture.suffix(), visibleGroups, ownerGroupId);
    }

    private GroupRow groupRow(Fixture fixture) {
        return jdbcTemplate.queryForObject("""
            SELECT is_deleted, deleted_at, deleted_by, leader_id, updated_at, updated_by
            FROM sys_group WHERE tenant_id=? AND id=?
            """, (result, rowNumber) -> new GroupRow(
                result.getBoolean("is_deleted"),
                result.getObject("deleted_at", LocalDateTime.class),
                result.getObject("deleted_by", Long.class),
                result.getObject("leader_id", Long.class),
                result.getObject("updated_at", LocalDateTime.class),
                result.getObject("updated_by", Long.class)),
            fixture.tenantId(), fixture.groupId());
    }

    private long lifecycleAuditCount(Fixture fixture) {
        Long count = jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM audit_log
            WHERE tenant_id=? AND module='group' AND target_type='group' AND target_id=?
            """, Long.class, fixture.tenantId(), fixture.groupId());
        return count == null ? 0 : count;
    }

    private long id(String sql, Object... arguments) {
        Long id = jdbcTemplate.queryForObject(sql, Long.class, arguments);
        assertNotNull(id);
        return id;
    }

    private void update(String sql, Object... arguments) {
        assertEquals(1, jdbcTemplate.update(sql, arguments));
    }

    private static String shortId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    private record Fixture(
        String tenantId,
        long groupId,
        String groupName,
        long userId,
        long roleId,
        long deviceId,
        long wikiSpaceId,
        long wikiPageId,
        long folderId,
        String suffix
    ) {}

    private record GroupRow(
        boolean deleted,
        LocalDateTime deletedAt,
        Long deletedBy,
        Long leaderId,
        LocalDateTime updatedAt,
        Long updatedBy
    ) {}

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @MapperScan("com.cwgsyw.platform")
    @Import({
        GroupReferenceInventoryService.class,
        GroupLifecycleService.class,
        MyBatisPlusConfig.class
    })
    static class TestApplication {}
}
