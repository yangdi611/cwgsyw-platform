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
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthorizationRelationshipCleanupServiceTest {
    @Mock JdbcTemplate jdbcTemplate;
    @Mock AuthorizationWriteLockService authorizationWriteLockService;

    private AuthorizationRelationshipCleanupService service;

    @BeforeEach
    void setUp() {
        service = new AuthorizationRelationshipCleanupService(jdbcTemplate, authorizationWriteLockService);
    }

    @Test
    void cleanupOrphanLegacyRoleRemovesOnlyVerifiedInvalidRelationship() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(4L), eq(4L))).thenReturn(1L);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(4L), eq(4L),
            eq("default"), eq("default"))).thenReturn(1L);
        when(jdbcTemplate.queryForList(anyString(), eq(Long.class), eq("default"), eq(4L),
            eq(4L))).thenReturn(java.util.List.of(9L, 3L, 9L));
        when(jdbcTemplate.update(anyString(), eq(1L), eq(1L), eq("default"),
            eq(4L), eq(4L), eq(4L), eq(4L))).thenReturn(0);
        when(jdbcTemplate.update(anyString(), eq(4L), eq(4L), eq(4L), eq(4L),
            eq("default"), eq("default"))).thenReturn(1);

        AuthorizationRelationshipCleanupResult result = service
            .cleanupOrphanLegacyRole("default", 4L, 4L, 1L);

        assertEquals(1, result.getLegacyUserRoles());
        assertEquals(1, result.getTotalRelationships());
        var lockOrder = inOrder(authorizationWriteLockService);
        lockOrder.verify(authorizationWriteLockService).lockUserAuthorization("default", 4L);
        lockOrder.verify(authorizationWriteLockService).lockRoleAuthorization("default", 4L);
        lockOrder.verify(authorizationWriteLockService).lockGroupAssignment("default", 4L, 3L);
        lockOrder.verify(authorizationWriteLockService).lockGroupAssignment("default", 4L, 9L);
    }

    @Test
    void cleanupDeletedUserLocksAllAffectedGroupsInStableOrder() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class),
            eq("default"), eq(7L))).thenReturn(1L);
        when(jdbcTemplate.queryForList(anyString(), eq(Long.class), eq(7L),
            eq("default"), eq(7L))).thenReturn(java.util.List.of(6L, 4L, 6L));
        when(jdbcTemplate.queryForList(anyString(), eq(Long.class), eq("default"), eq(7L),
            eq("default"), eq(7L))).thenReturn(java.util.List.of(11L, 2L, 11L));

        service.cleanupDeletedUser("default", 7L, 1L);

        var lockOrder = inOrder(authorizationWriteLockService);
        lockOrder.verify(authorizationWriteLockService).lockUserAuthorization("default", 7L);
        lockOrder.verify(authorizationWriteLockService).lockRoleAuthorization("default", 4L);
        lockOrder.verify(authorizationWriteLockService).lockRoleAuthorization("default", 6L);
        lockOrder.verify(authorizationWriteLockService).lockGroupAssignment("default", 7L, 2L);
        lockOrder.verify(authorizationWriteLockService).lockGroupAssignment("default", 7L, 11L);
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
