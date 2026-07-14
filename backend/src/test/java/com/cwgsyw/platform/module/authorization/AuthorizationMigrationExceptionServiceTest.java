package com.cwgsyw.platform.module.authorization;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.sql.ResultSet;

import com.cwgsyw.platform.module.authorization.dto.AuthorizationRelationshipCleanupResult;
import com.cwgsyw.platform.module.authorization.dto.RoleAclConversionResult;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthorizationMigrationExceptionServiceTest {
    @Mock JdbcTemplate jdbcTemplate;
    @Mock ResultSet resultSet;
    @Mock AuthorizationRelationshipCleanupService relationshipCleanupService;
    @Mock LegacyRoleAclRemediationService roleAclRemediationService;

    private AuthorizationMigrationExceptionService service;

    @BeforeEach
    void setUp() {
        service = new AuthorizationMigrationExceptionService(
            jdbcTemplate, relationshipCleanupService, roleAclRemediationService);
    }

    @Test
    void acceptedLegacyLocksBothModulesAndAudits() throws Exception {
        when(resultSet.next()).thenReturn(true);
        when(resultSet.getObject("user_id")).thenReturn(7L);
        when(resultSet.getString("source_type")).thenReturn("user_role");
        when(resultSet.getString("source_key")).thenReturn("sys_user_role:7:4");
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(8L), eq("default")))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(resultSet));
        when(jdbcTemplate.update(anyString(), eq("accepted_legacy"), anyString(), eq(1L), eq("default"),
            eq("user_role"), eq("sys_user_role:7:4"), eq("accepted_legacy"))).thenReturn(2);

        service.resolve(8L, "default", "acceptedLegacy", "业务确认永久保留旧权限", 1L);

        verify(jdbcTemplate).update(anyString(), eq("default"), eq(7L), eq("wiki"));
        verify(jdbcTemplate).update(anyString(), eq("default"), eq(7L), eq("shared_file"));
        verify(jdbcTemplate).update(anyString(), eq("default"), eq(8L), eq(1L), anyString());
    }

    @Test
    void resolvedDoesNotLockRollout() throws Exception {
        when(resultSet.next()).thenReturn(true);
        when(resultSet.getObject("user_id")).thenReturn(7L);
        when(resultSet.getString("source_type")).thenReturn("user_role");
        when(resultSet.getString("source_key")).thenReturn("sys_user_role:7:4");
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(8L), eq("default")))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(resultSet));
        when(jdbcTemplate.update(anyString(), eq("resolved"), anyString(), eq(1L), eq("default"),
            eq("user_role"), eq("sys_user_role:7:4"), eq("resolved"))).thenReturn(1);

        service.resolve(8L, "default", "resolved", "已修复主组并完成重跑", 1L);

        verify(jdbcTemplate, never()).update(anyString(), eq("default"), eq(7L), eq("wiki"));
    }

    @Test
    void rejectsUnknownResolutionStatus() {
        assertThrows(IllegalArgumentException.class,
            () -> service.resolve(8L, "default", "ignored", "非法状态不能保存", 1L));
        verify(jdbcTemplate, never()).query(anyString(), any(ResultSetExtractor.class), any(), any());
    }

    @Test
    void cleanupOrphanRoleRemovesRelationshipResolvesExceptionAndAudits() throws Exception {
        when(resultSet.next()).thenReturn(true);
        when(resultSet.getString("source_type")).thenReturn("user_role");
        when(resultSet.getString("source_key")).thenReturn("sys_user_role:4:4");
        when(resultSet.getString("reason_code")).thenReturn("ORPHAN_USER_ROLE");
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(513L), eq("default")))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(resultSet));
        when(relationshipCleanupService.cleanupOrphanLegacyRole("default", 4L, 4L, 1L))
            .thenReturn(AuthorizationRelationshipCleanupResult.builder()
                .legacyUserRoles(1).totalRelationships(1).build());
        when(jdbcTemplate.update(anyString(), anyString(), eq(1L), eq("default"),
            eq("user_role"), eq("sys_user_role:4:4"))).thenReturn(2);

        AuthorizationRelationshipCleanupResult result = service.cleanup(513L, "default", 1L);

        assertEquals(1, result.getTotalRelationships());
        assertEquals(2, result.getResolvedExceptions());
        verify(relationshipCleanupService).cleanupOrphanLegacyRole("default", 4L, 4L, 1L);
        verify(jdbcTemplate).update(anyString(), eq("default"),
            eq("invalid_relationship_cleanup"), eq(513L), eq(1L), anyString());
    }

    @Test
    void cleanupEmptyRoleAclResolvesExceptionAndAudits() throws Exception {
        when(resultSet.next()).thenReturn(true);
        when(resultSet.getString("source_type")).thenReturn("shared_folder_acl");
        when(resultSet.getString("source_key")).thenReturn("shared_folder_acl:10");
        when(resultSet.getString("reason_code")).thenReturn("ROLE_ACL_NEEDS_REVIEW");
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(511L), eq("default")))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(resultSet));
        when(roleAclRemediationService.cleanupEmptyRoleAcl(
            "default", "shared_folder_acl", "shared_folder_acl:10", 1L))
            .thenReturn(AuthorizationRelationshipCleanupResult.builder()
                .legacyAclEntries(1).totalRelationships(1).build());
        when(jdbcTemplate.update(anyString(), anyString(), eq(1L), eq("default"),
            eq("shared_folder_acl"), eq("shared_folder_acl:10"))).thenReturn(1);

        AuthorizationRelationshipCleanupResult result = service.cleanup(511L, "default", 1L);

        assertEquals(1, result.getLegacyAclEntries());
        assertEquals(1, result.getResolvedExceptions());
        verify(roleAclRemediationService).cleanupEmptyRoleAcl(
            "default", "shared_folder_acl", "shared_folder_acl:10", 1L);
    }

    @Test
    void convertRoleAclResolvesExceptionAndAudits() throws Exception {
        when(resultSet.next()).thenReturn(true);
        when(resultSet.getString("source_type")).thenReturn("wiki_space_acl");
        when(resultSet.getString("source_key")).thenReturn("wiki_space_acl:16");
        when(resultSet.getString("reason_code")).thenReturn("ROLE_ACL_NEEDS_REVIEW");
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(514L), eq("default")))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(resultSet));
        when(roleAclRemediationService.convert(
            "default", "wiki_space_acl", "wiki_space_acl:16", "group", 3L, 1L))
            .thenReturn(RoleAclConversionResult.builder()
                .sourceRoleId(1L).resourceType("wiki_space").resourceId(2L)
                .targetSubjectType("group").targetSubjectId(3L).legacyAclEntries(1).build());
        when(jdbcTemplate.update(anyString(), anyString(), eq(1L), eq("default"),
            eq("wiki_space_acl"), eq("wiki_space_acl:16"))).thenReturn(1);

        RoleAclConversionResult result = service.convertRoleAcl(
            514L, "default", "group", 3L, 1L);

        assertEquals(1, result.getResolvedExceptions());
        verify(roleAclRemediationService).convert(
            "default", "wiki_space_acl", "wiki_space_acl:16", "group", 3L, 1L);
    }
}
