package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.module.authorization.dto.AuthorizationRelationshipCleanupResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthorizationRelationshipCleanupServiceTest {
    @Mock JdbcTemplate jdbcTemplate;

    private AuthorizationRelationshipCleanupService service;

    @BeforeEach
    void setUp() {
        service = new AuthorizationRelationshipCleanupService(jdbcTemplate);
    }

    @Test
    void cleanupOrphanLegacyRoleRemovesOnlyVerifiedInvalidRelationship() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(4L), eq(4L))).thenReturn(1L);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(4L), eq(4L),
            eq("default"), eq("default"))).thenReturn(1L);
        when(jdbcTemplate.update(anyString(), eq(1L), eq(1L), eq("default"),
            eq(4L), eq(4L), eq(4L), eq(4L))).thenReturn(0);
        when(jdbcTemplate.update(anyString(), eq(4L), eq(4L), eq(4L), eq(4L),
            eq("default"), eq("default"))).thenReturn(1);

        AuthorizationRelationshipCleanupResult result = service
            .cleanupOrphanLegacyRole("default", 4L, 4L, 1L);

        assertEquals(1, result.getLegacyUserRoles());
        assertEquals(1, result.getTotalRelationships());
    }

    @Test
    void cleanupOrphanLegacyRoleRejectsValidRelationship() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(4L), eq(4L))).thenReturn(1L);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(4L), eq(4L),
            eq("default"), eq("default"))).thenReturn(0L);

        assertThrows(IllegalStateException.class,
            () -> service.cleanupOrphanLegacyRole("default", 4L, 4L, 1L));

        verify(jdbcTemplate, never()).update(anyString(), eq(4L), eq(4L), eq(4L), eq(4L),
            eq("default"), eq("default"));
    }

    @Test
    void cleanupOrphanLegacyRoleClosesStaleExceptionWhenRelationshipIsAlreadyGone() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(4L), eq(4L))).thenReturn(0L);

        AuthorizationRelationshipCleanupResult result = service
            .cleanupOrphanLegacyRole("default", 4L, 4L, 1L);

        assertEquals(0, result.getTotalRelationships());
        verify(jdbcTemplate, never()).update(anyString(), eq(4L), eq(4L), eq(4L), eq(4L),
            eq("default"), eq("default"));
    }

    @Test
    void requireNoOwnedResourcesBlocksDeletion() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class),
            eq("default"), eq(7L), eq("default"), eq(7L),
            eq("default"), eq(7L), eq("default"), eq(7L))).thenReturn(2L);

        assertThrows(IllegalStateException.class,
            () -> service.requireNoOwnedResources("default", 7L));
    }
}
