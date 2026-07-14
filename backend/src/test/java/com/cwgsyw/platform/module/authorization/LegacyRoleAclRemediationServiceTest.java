package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.module.authorization.dto.AuthorizationRelationshipCleanupResult;
import com.cwgsyw.platform.module.authorization.dto.RoleAclConversionResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.sql.ResultSet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LegacyRoleAclRemediationServiceTest {
    @Mock JdbcTemplate jdbcTemplate;
    @Mock ResultSet resultSet;

    private LegacyRoleAclRemediationService service;

    @BeforeEach
    void setUp() {
        service = new LegacyRoleAclRemediationService(jdbcTemplate, new ObjectMapper());
    }

    @Test
    void cleanupEmptyRoleAclRemovesVerifiedSource() throws Exception {
        sourceRow(1L, "role", 5L, "[\"read\",\"write\"]", false);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(1L), eq("default")))
            .thenReturn(1L);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(5L), eq("default")))
            .thenReturn(1L);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class),
            eq(5L), eq("default"), eq(5L), eq("default"))).thenReturn(0L);
        when(jdbcTemplate.update(anyString(), eq(1L), eq(10L), eq("default"), eq(5L)))
            .thenReturn(1);

        AuthorizationRelationshipCleanupResult result = service.cleanupEmptyRoleAcl(
            "default", "shared_folder_acl", "shared_folder_acl:10", 1L);

        assertEquals(1, result.getLegacyAclEntries());
        assertEquals(1, result.getTotalRelationships());
    }

    @Test
    void cleanupRejectsRoleWithActiveUsers() throws Exception {
        sourceRow(1L, "role", 5L, "[\"read\"]", false);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(1L), eq("default")))
            .thenReturn(1L);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(5L), eq("default")))
            .thenReturn(1L);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class),
            eq(5L), eq("default"), eq(5L), eq("default"))).thenReturn(2L);

        IllegalStateException error = assertThrows(IllegalStateException.class,
            () -> service.cleanupEmptyRoleAcl(
                "default", "shared_folder_acl", "shared_folder_acl:10", 1L));

        assertEquals("角色仍命中 2 个有效账户，请转换为指定用户或组", error.getMessage());
        verify(jdbcTemplate, never()).update(anyString(),
            eq(1L), eq(10L), eq("default"), eq(5L));
    }

    @Test
    void convertRoleAclWritesLegacyAndNewAclThenRemovesRoleSource() throws Exception {
        sourceRow(1L, "role", 5L, "[\"read\",\"write\"]", false);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(5L), eq("default")))
            .thenReturn(1L);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(1L), eq("default")))
            .thenReturn(1L);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(3L), eq("default")))
            .thenReturn(1L);
        when(jdbcTemplate.update(anyString(), eq("[\"read\",\"write\"]"),
            eq("default"), eq(1L), eq("group"), eq(3L))).thenReturn(0);
        when(jdbcTemplate.update(anyString(), eq("default"), eq(1L), eq("group"), eq(3L),
            eq("[\"read\",\"write\"]"), eq(1L))).thenReturn(1);
        when(jdbcTemplate.update(anyString(), eq("default"), eq("shared_folder"), eq(1L),
            eq("group"), eq(3L), eq(7), eq(1L))).thenReturn(1);
        when(jdbcTemplate.update(anyString(), eq(1L), eq(10L), eq("default"), eq(5L)))
            .thenReturn(1);

        RoleAclConversionResult result = service.convert(
            "default", "shared_folder_acl", "shared_folder_acl:10", "group", 3L, 1L);

        assertEquals(1, result.getLegacyAclEntries());
        assertEquals(1, result.getResourceAclEntries());
        assertEquals("group", result.getTargetSubjectType());
    }

    @Test
    void rejectsUnknownSourceTable() {
        assertThrows(IllegalArgumentException.class, () -> service.cleanupEmptyRoleAcl(
            "default", "audit_log", "audit_log:10", 1L));
        verify(jdbcTemplate, never()).query(anyString(), any(ResultSetExtractor.class), any(), any());
    }

    private void sourceRow(Long resourceId, String subjectType, Long subjectId,
                           String permissions, boolean deleted) throws Exception {
        when(resultSet.next()).thenReturn(true);
        when(resultSet.getObject("resource_id")).thenReturn(resourceId);
        when(resultSet.getString("subject_type")).thenReturn(subjectType);
        when(resultSet.getObject("subject_id")).thenReturn(subjectId);
        when(resultSet.getString("permissions")).thenReturn(permissions);
        when(resultSet.getBoolean("is_deleted")).thenReturn(deleted);
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(10L), eq("default")))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(resultSet));
    }
}
