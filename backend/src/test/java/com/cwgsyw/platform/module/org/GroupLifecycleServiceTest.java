package com.cwgsyw.platform.module.org;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.authorization.AuthorizationModeService;
import com.cwgsyw.platform.module.org.dto.GroupLifecycleActionRequest;
import com.cwgsyw.platform.module.org.dto.GroupLifecycleBlocker;
import com.cwgsyw.platform.module.org.dto.GroupLifecyclePreflightVO;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.rbac.RoleAssignmentService;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GroupLifecycleServiceTest {
    @Mock GroupMapper groupMapper;
    @Mock GroupReferenceInventoryService inventoryService;
    @Mock AuditLogMapper auditLogMapper;
    @Mock JdbcTemplate jdbcTemplate;
    @Mock AuthorizationModeService authorizationModeService;
    @Mock RoleAssignmentService roleAssignmentService;

    private GroupLifecycleService service;

    @BeforeEach
    void setUp() {
        ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        service = new GroupLifecycleService(groupMapper, inventoryService, auditLogMapper,
            jdbcTemplate, objectMapper, authorizationModeService, roleAssignmentService);
        ReflectionTestUtils.setField(service, "purgeRetentionDays", 30);
    }

    @Test
    void enforcedPermissionAndScopeMustComeFromSameEffectiveAssignment() {
        SecurityUser user = user("tenant", Set.of("group:delete"));
        when(authorizationModeService.effectiveMode("default"))
            .thenReturn(AuthorizationModeService.EffectiveMode.ENFORCED);
        when(roleAssignmentService.findEffectiveScopesForPermission(7L, "default", "group:delete"))
            .thenReturn(List.of("group"));

        GroupLifecycleException error = assertThrows(GroupLifecycleException.class,
            () -> service.preflight(11L, "archive", user));

        assertEquals(403, error.getHttpStatus());
        assertEquals("GROUP_LIFECYCLE_SCOPE_DENIED", error.getErrorCode());
        verify(groupMapper, never()).findByTenantAndIdIncludingDeleted(any(), any());
    }

    @Test
    void enforcedPermissionBearingTenantAssignmentAllowsArchivePreflight() {
        SecurityUser user = user("group", Set.of());
        Group group = group(false, false, "business", LocalDateTime.now().minusDays(1));
        when(authorizationModeService.effectiveMode("default"))
            .thenReturn(AuthorizationModeService.EffectiveMode.ENFORCED);
        when(roleAssignmentService.findEffectiveScopesForPermission(7L, "default", "group:delete"))
            .thenReturn(List.of("tenant"));
        when(groupMapper.findByTenantAndIdIncludingDeleted("default", 11L)).thenReturn(group);
        when(inventoryService.snapshotForArchive("default", 11L)).thenReturn(emptySnapshot());

        GroupLifecyclePreflightVO preflight = service.preflight(11L, "archive", user);

        assertTrue(preflight.eligible());
    }

    @Test
    void archivePermissionDenialsReturnTrue403WithoutReadingOrMutatingGroup() {
        SecurityUser missingPermission = user("tenant", Set.of());
        when(authorizationModeService.effectiveMode("default"))
            .thenReturn(AuthorizationModeService.EffectiveMode.ENFORCED);
        when(roleAssignmentService.findEffectiveScopesForPermission(7L, "default", "group:delete"))
            .thenReturn(List.of());
        GroupLifecycleException missing = assertThrows(GroupLifecycleException.class,
            () -> service.preflight(11L, "archive", missingPermission));
        assertEquals(403, missing.getHttpStatus());
        assertEquals("ACCESS_DENIED", missing.getErrorCode());
        assertPermissionDenialHasNoGroupOrAuditEffects();

        clearInvocations(groupMapper, inventoryService, auditLogMapper);
        when(roleAssignmentService.findEffectiveScopesForPermission(7L, "default", "group:delete"))
            .thenReturn(List.of("group"));
        GroupLifecycleException groupScope = assertThrows(GroupLifecycleException.class,
            () -> service.preflight(11L, "archive", user("group", Set.of("group:delete"))));
        assertEquals(403, groupScope.getHttpStatus());
        assertEquals("GROUP_LIFECYCLE_SCOPE_DENIED", groupScope.getErrorCode());
        assertPermissionDenialHasNoGroupOrAuditEffects();

        clearInvocations(groupMapper, inventoryService, auditLogMapper);
        when(roleAssignmentService.findEffectiveScopesForPermission(7L, "default", "group:delete"))
            .thenReturn(List.of());
        GroupLifecycleException expired = assertThrows(GroupLifecycleException.class,
            () -> service.preflight(11L, "archive", user("tenant", Set.of("group:delete"))));
        assertEquals(403, expired.getHttpStatus());
        assertEquals("ACCESS_DENIED", expired.getErrorCode());
        assertPermissionDenialHasNoGroupOrAuditEffects();
    }

    @Test
    void purgePermissionAndScopeDenialsReturnTrue403WithoutReadingOrMutatingGroup() {
        when(authorizationModeService.effectiveMode("default"))
            .thenReturn(AuthorizationModeService.EffectiveMode.ENFORCED);

        when(roleAssignmentService.findEffectiveScopesForPermission(7L, "default", "group:purge"))
            .thenReturn(List.of());
        GroupLifecycleException missingPermission = assertThrows(GroupLifecycleException.class,
            () -> service.preflight(11L, "purge", user("platform", Set.of())));
        assertEquals(403, missingPermission.getHttpStatus());
        assertEquals("ACCESS_DENIED", missingPermission.getErrorCode());
        assertPermissionDenialHasNoGroupOrAuditEffects();

        clearInvocations(groupMapper, inventoryService, auditLogMapper);
        when(roleAssignmentService.findEffectiveScopesForPermission(7L, "default", "group:purge"))
            .thenReturn(List.of("tenant"));
        GroupLifecycleException tenantScope = assertThrows(GroupLifecycleException.class,
            () -> service.preflight(11L, "purge", user("tenant", Set.of("group:purge"))));
        assertEquals(403, tenantScope.getHttpStatus());
        assertEquals("GROUP_LIFECYCLE_SCOPE_DENIED", tenantScope.getErrorCode());
        assertPermissionDenialHasNoGroupOrAuditEffects();
    }

    @Test
    void shadowModeKeepsExistingSessionPermissionAndScopeContract() {
        SecurityUser user = user("tenant", Set.of("group:delete"));
        Group group = group(false, false, "business", LocalDateTime.now().minusDays(1));
        when(authorizationModeService.effectiveMode("default"))
            .thenReturn(AuthorizationModeService.EffectiveMode.SHADOW);
        when(groupMapper.findByTenantAndIdIncludingDeleted("default", 11L)).thenReturn(group);
        when(inventoryService.snapshotForArchive("default", 11L)).thenReturn(emptySnapshot());

        assertTrue(service.preflight(11L, "archive", user).eligible());
        verify(roleAssignmentService, never()).findEffectiveScopesForPermission(any(), any(), any());
    }

    @Test
    void protectedAndWrongStatePreflightsReturnStructuredBlockers() {
        SecurityUser deleteUser = legacyUser("tenant", "group:delete");
        Group builtin = group(false, true, "business", LocalDateTime.now().minusDays(1));
        when(groupMapper.findByTenantAndIdIncludingDeleted("default", 11L)).thenReturn(builtin);

        GroupLifecyclePreflightVO protectedPreflight = service.preflight(11L, "archive", deleteUser);
        assertFalse(protectedPreflight.eligible());
        assertEquals("GROUP_BUILTIN_PROTECTED", protectedPreflight.blockers().getFirst().reasonCode());

        Group unassigned = group(false, true, "unassigned", LocalDateTime.now().minusDays(1));
        when(groupMapper.findByTenantAndIdIncludingDeleted("default", 13L)).thenReturn(unassigned);

        GroupLifecyclePreflightVO unassignedPreflight = service.preflight(13L, "archive", deleteUser);
        assertFalse(unassignedPreflight.eligible());
        assertEquals("GROUP_UNASSIGNED_PROTECTED", unassignedPreflight.blockers().getFirst().reasonCode());

        SecurityUser updateUser = legacyUser("tenant", "group:update");
        Group active = group(false, false, "business", LocalDateTime.now().minusDays(1));
        when(groupMapper.findByTenantAndIdIncludingDeleted("default", 12L)).thenReturn(active);

        GroupLifecyclePreflightVO wrongState = service.preflight(12L, "restore", updateUser);
        assertFalse(wrongState.eligible());
        assertEquals("GROUP_NOT_ARCHIVED", wrongState.blockers().getFirst().reasonCode());
    }

    @Test
    void protectedAndCrossTenantArchiveExecutionRejectWithoutGroupOrAuditMutation() {
        SecurityUser user = legacyUser("tenant", "group:delete");

        Group builtin = group(false, true, "business", LocalDateTime.now().minusDays(1));
        when(groupMapper.lockByTenantAndIdIncludingDeleted("default", 11L)).thenReturn(builtin);
        GroupLifecycleException builtinError = assertThrows(GroupLifecycleException.class,
            () -> service.archive(11L, request(builtin), user));
        assertEquals(409, builtinError.getHttpStatus());
        assertEquals("GROUP_BUILTIN_PROTECTED", builtinError.getErrorCode());
        assertRejectedArchiveHasNoMutation();

        clearInvocations(groupMapper, inventoryService, auditLogMapper);
        Group unassigned = group(false, false, "unassigned", LocalDateTime.now().minusDays(1));
        when(groupMapper.lockByTenantAndIdIncludingDeleted("default", 11L)).thenReturn(unassigned);
        GroupLifecycleException unassignedError = assertThrows(GroupLifecycleException.class,
            () -> service.archive(11L, request(unassigned), user));
        assertEquals(409, unassignedError.getHttpStatus());
        assertEquals("GROUP_UNASSIGNED_PROTECTED", unassignedError.getErrorCode());
        assertRejectedArchiveHasNoMutation();

        clearInvocations(groupMapper, inventoryService, auditLogMapper);
        when(groupMapper.lockByTenantAndIdIncludingDeleted("default", 11L)).thenReturn(null);
        GroupLifecycleException crossTenantError = assertThrows(GroupLifecycleException.class,
            () -> service.archive(11L, request(group(false, false, "business",
                LocalDateTime.now().minusDays(1))), user));
        assertEquals(404, crossTenantError.getHttpStatus());
        assertEquals("GROUP_NOT_FOUND", crossTenantError.getErrorCode());
        assertRejectedArchiveHasNoMutation();
    }

    @Test
    void restoreCodeConflictPreflightAndExecutionUseSameBlocker() {
        SecurityUser user = legacyUser("tenant", "group:update");
        Group archived = group(true, false, "business", LocalDateTime.now().minusDays(40));
        when(groupMapper.findByTenantAndIdIncludingDeleted("default", 11L)).thenReturn(archived);
        when(groupMapper.lockByTenantAndIdIncludingDeleted("default", 11L)).thenReturn(archived);
        when(groupMapper.countActiveCodeConflict("default", "group_11", 11L)).thenReturn(1L);

        GroupLifecyclePreflightVO preflight = service.preflight(11L, "restore", user);
        assertEquals("GROUP_RESTORE_CODE_CONFLICT", preflight.blockers().getFirst().reasonCode());

        GroupLifecycleException error = assertThrows(GroupLifecycleException.class,
            () -> service.restore(11L, request(archived), user));
        assertEquals("GROUP_RESTORE_CODE_CONFLICT", error.getErrorCode());
        assertEquals(preflight.blockers(), error.getPreflight().blockers());
        verify(groupMapper, never()).restoreArchived(any(), any(), any(), any());
    }

    @Test
    void restoreNameConflictPreflightAndExecutionUseSameBlocker() {
        SecurityUser user = legacyUser("tenant", "group:update");
        Group archived = group(true, false, "business", LocalDateTime.now().minusDays(40));
        when(groupMapper.findByTenantAndIdIncludingDeleted("default", 11L)).thenReturn(archived);
        when(groupMapper.lockByTenantAndIdIncludingDeleted("default", 11L)).thenReturn(archived);
        when(groupMapper.countActiveNameConflict("default", "group name", 11L)).thenReturn(1L);

        GroupLifecyclePreflightVO preflight = service.preflight(11L, "restore", user);
        assertEquals("GROUP_RESTORE_NAME_CONFLICT", preflight.blockers().getFirst().reasonCode());

        GroupLifecycleException error = assertThrows(GroupLifecycleException.class,
            () -> service.restore(11L, request(archived), user));
        assertEquals("GROUP_RESTORE_NAME_CONFLICT", error.getErrorCode());
        assertEquals(preflight.blockers(), error.getPreflight().blockers());
        verify(groupMapper, never()).restoreArchived(any(), any(), any(), any());
    }

    @Test
    void restoreConcurrentNameConflictKeepsLifecycleContract() {
        SecurityUser user = legacyUser("tenant", "group:update");
        Group archived = group(true, false, "business", LocalDateTime.now().minusDays(40));
        when(groupMapper.lockByTenantAndIdIncludingDeleted("default", 11L)).thenReturn(archived);
        when(groupMapper.restoreArchived("default", 11L, 7L, archived.getUpdatedAt()))
            .thenThrow(new DataIntegrityViolationException("writer failed",
                new SQLException("uq_sys_group_tenant_name_active", "23505")));

        GroupLifecycleException error = assertThrows(GroupLifecycleException.class,
            () -> service.restore(11L, request(archived), user));

        assertEquals(409, error.getHttpStatus());
        assertEquals("GROUP_RESTORE_NAME_CONFLICT", error.getErrorCode());
        verify(auditLogMapper, never()).insert(any(AuditLog.class));
    }

    @Test
    void restoreOnlyChangesGroupAndRejectsRepeatedOrStaleRequests() {
        SecurityUser user = legacyUser("tenant", "group:update");
        LocalDateTime archivedUpdatedAt = LocalDateTime.now().minusDays(1);
        Group archived = group(true, false, "business", archivedUpdatedAt);
        Group restored = group(false, false, "business", LocalDateTime.now());
        when(groupMapper.lockByTenantAndIdIncludingDeleted("default", 11L))
            .thenReturn(archived, restored, archived);
        when(groupMapper.countActiveCodeConflict("default", "group_11", 11L)).thenReturn(0L);
        when(groupMapper.restoreArchived("default", 11L, 7L, archivedUpdatedAt)).thenReturn(1);
        when(groupMapper.findByTenantAndIdIncludingDeleted("default", 11L)).thenReturn(restored);
        when(auditLogMapper.insert(any(AuditLog.class))).thenAnswer(invocation -> {
            invocation.<AuditLog>getArgument(0).setId(601L);
            return 1;
        });

        var result = service.restore(11L, request(archived), user);
        assertTrue(result.changed());
        assertFalse(result.restoredRelations());

        GroupLifecycleException repeated = assertThrows(GroupLifecycleException.class,
            () -> service.restore(11L, request(restored), user));
        assertEquals(409, repeated.getHttpStatus());
        assertEquals("GROUP_NOT_ARCHIVED", repeated.getErrorCode());

        GroupLifecycleActionRequest stale = request(archived);
        stale.setExpectedUpdatedAt(archivedUpdatedAt.minusMinutes(1));
        GroupLifecycleException version = assertThrows(GroupLifecycleException.class,
            () -> service.restore(11L, stale, user));
        assertEquals(409, version.getHttpStatus());
        assertEquals("GROUP_VERSION_CONFLICT", version.getErrorCode());
    }

    @Test
    void purgePreflightIncludesRetentionAndReferenceBlockers() {
        SecurityUser user = legacyUser("platform", "group:purge");
        Group archived = group(true, false, "business", LocalDateTime.now().minusDays(2));
        GroupLifecycleBlocker referenceBlocker = new GroupLifecycleBlocker(
            "GROUP_PURGE_REFERENCE_MEMBERSHIPS", "memberships", 1,
            "仍有引用", "先解除引用");
        when(groupMapper.findByTenantAndIdIncludingDeleted("default", 11L)).thenReturn(archived);
        when(inventoryService.snapshotForPurge("default", 11L)).thenReturn(
            new GroupReferenceInventoryService.ReferenceSnapshot(
                Map.of(), Map.of("memberships", 1L), List.of(referenceBlocker)));

        GroupLifecyclePreflightVO preflight = service.preflight(11L, "purge", user);

        assertFalse(preflight.eligible());
        assertEquals(List.of("GROUP_PURGE_RETENTION_NOT_MET", "GROUP_PURGE_REFERENCE_MEMBERSHIPS"),
            preflight.blockers().stream().map(GroupLifecycleBlocker::reasonCode).toList());
        assertEquals(archived.getDeletedAt().plusDays(30), preflight.purgeEligibleAt());
    }

    @Test
    void missingExpectedUpdatedAtHasIndependentBadRequestCode() {
        SecurityUser user = legacyUser("tenant", "group:delete");
        GroupLifecycleActionRequest request = new GroupLifecycleActionRequest();
        request.setReason("REM-P1-001 valid reason");
        request.setConfirmationName("group name");

        GroupLifecycleException error = assertThrows(GroupLifecycleException.class,
            () -> service.archive(11L, request, user));

        assertEquals(400, error.getHttpStatus());
        assertEquals("GROUP_EXPECTED_UPDATED_AT_REQUIRED", error.getErrorCode());
        verify(groupMapper, never()).lockByTenantAndIdIncludingDeleted(any(), any());
    }

    @Test
    void archiveAuditCapturesCompleteBeforeAndRealAfterMetadata() {
        SecurityUser user = legacyUser("tenant", "group:delete");
        LocalDateTime initialUpdatedAt = LocalDateTime.now().minusDays(1);
        Group active = group(false, false, "business", initialUpdatedAt);
        active.setLeaderId(88L);
        Group archived = group(true, false, "business", LocalDateTime.now());
        archived.setLeaderId(88L);
        archived.setDeletedAt(LocalDateTime.now().minusSeconds(1));
        archived.setDeletedBy(7L);
        archived.setUpdatedBy(7L);
        when(groupMapper.lockByTenantAndIdIncludingDeleted("default", 11L)).thenReturn(active);
        when(inventoryService.snapshotForArchive("default", 11L)).thenReturn(emptySnapshot());
        when(groupMapper.archiveActive("default", 11L, 7L, initialUpdatedAt)).thenReturn(1);
        when(groupMapper.findByTenantAndIdIncludingDeleted("default", 11L)).thenReturn(archived);
        when(auditLogMapper.insert(any(AuditLog.class))).thenAnswer(invocation -> {
            invocation.<AuditLog>getArgument(0).setId(501L);
            return 1;
        });

        service.archive(11L, request(active), user);

        ArgumentCaptor<AuditLog> auditCaptor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(auditCaptor.capture());
        AuditLog audit = auditCaptor.getValue();
        assertTrue(audit.getBeforeJson().contains("\"snapshotHash\":\"sha256:"));
        assertTrue(audit.getAfterJson().contains("\"snapshotHash\":\"sha256:"));
        assertTrue(audit.getBeforeJson().contains("\"leaderId\":88"));
        assertTrue(audit.getBeforeJson().contains("\"name\":\"group name\""));
        assertTrue(audit.getBeforeJson().contains("\"state\":\"active\""));
        assertTrue(audit.getBeforeJson().contains("\"isDeleted\":false"));
        assertTrue(audit.getBeforeJson().contains("\"deletedAt\":null"));
        assertTrue(audit.getBeforeJson().contains("\"deletedBy\":null"));
        assertTrue(audit.getAfterJson().contains("\"isDeleted\":true"));
        assertTrue(audit.getAfterJson().contains("\"name\":\"group name\""));
        assertTrue(audit.getAfterJson().contains("\"state\":\"archived\""));
        assertTrue(audit.getAfterJson().contains("\"deletedBy\":7"));
        assertTrue(audit.getAfterJson().contains("\"relationsChanged\":false"));
    }

    private SecurityUser legacyUser(String scope, String permission) {
        when(authorizationModeService.effectiveMode("default"))
            .thenReturn(AuthorizationModeService.EffectiveMode.LEGACY);
        return user(scope, Set.of(permission));
    }

    private SecurityUser user(String scope, Set<String> permissions) {
        return new SecurityUser(7L, "operator", "", "default", 1L, scope, permissions);
    }

    private Group group(boolean deleted, boolean builtin, String groupType, LocalDateTime updatedAt) {
        Group group = new Group();
        group.setId(11L);
        group.setTenantId("default");
        group.setCode("group_11");
        group.setName("group name");
        group.setGroupType(groupType);
        group.setIsBuiltin(builtin);
        group.setIsDeleted(deleted);
        group.setUpdatedAt(updatedAt);
        if (deleted) group.setDeletedAt(updatedAt.minusDays(1));
        return group;
    }

    private GroupLifecycleActionRequest request(Group group) {
        GroupLifecycleActionRequest request = new GroupLifecycleActionRequest();
        request.setReason("REM-P1-001 valid reason");
        request.setConfirmationName(group.getName());
        request.setExpectedUpdatedAt(group.getUpdatedAt());
        request.setExpectedArchivedAt(group.getDeletedAt());
        return request;
    }

    private GroupReferenceInventoryService.ReferenceSnapshot emptySnapshot() {
        return new GroupReferenceInventoryService.ReferenceSnapshot(Map.of(), Map.of(), List.of());
    }

    private void assertPermissionDenialHasNoGroupOrAuditEffects() {
        verify(groupMapper, never()).findByTenantAndIdIncludingDeleted(any(), any());
        verify(groupMapper, never()).lockByTenantAndIdIncludingDeleted(any(), any());
        verify(groupMapper, never()).archiveActive(any(), any(), any(), any());
        verify(groupMapper, never()).hardDeleteArchived(any(), any(), any());
        verify(inventoryService, never()).snapshotForArchive(any(), any());
        verify(inventoryService, never()).snapshotForPurge(any(), any());
        verify(auditLogMapper, never()).insert(any(AuditLog.class));
    }

    private void assertRejectedArchiveHasNoMutation() {
        verify(groupMapper, never()).archiveActive(any(), any(), any(), any());
        verify(inventoryService, never()).snapshotForArchive(any(), any());
        verify(auditLogMapper, never()).insert(any(AuditLog.class));
    }
}
