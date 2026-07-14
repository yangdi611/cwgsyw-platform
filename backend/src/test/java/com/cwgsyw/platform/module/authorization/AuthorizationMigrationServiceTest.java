package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;

class AuthorizationMigrationServiceTest {
    @Test
    void migrationLocksEveryUserBeforeGroupTuplesInStableOrder() {
        AuthorizationWriteLockService writeLockService = mock(AuthorizationWriteLockService.class);
        AuthorizationMigrationService service = new AuthorizationMigrationService(
            mock(JdbcTemplate.class), writeLockService, mock(ActiveGroupReferenceValidator.class));

        List<Map<String, Object>> users = List.of(
            Map.of("id", 8L, "tenant_id", "tenant-b"),
            Map.of("id", 6L, "tenant_id", "tenant-a", "group_id", 9L));
        List<Map<String, Object>> leaders = List.of(
            Map.of("leader_id", 5L, "tenant_id", "tenant-a", "group_id", 7L));
        List<Map<String, Object>> userRoles = List.of(
            Map.of("user_id", 4L, "role_id", 12L, "user_tenant_id", "tenant-a", "scope", "tenant"),
            Map.of("user_id", 3L, "role_id", 10L, "user_tenant_id", "tenant-a", "scope", "platform"),
            Map.of("user_id", 6L, "role_id", 11L, "user_tenant_id", "tenant-a", "scope", "group", "group_id", 2L));

        ReflectionTestUtils.invokeMethod(service, "lockMigrationWrites", users, leaders, userRoles);

        var order = inOrder(writeLockService);
        order.verify(writeLockService).lockUserAuthorization("tenant-a", 3L);
        order.verify(writeLockService).lockUserAuthorization("tenant-a", 4L);
        order.verify(writeLockService).lockUserAuthorization("tenant-a", 5L);
        order.verify(writeLockService).lockUserAuthorization("tenant-a", 6L);
        order.verify(writeLockService).lockUserAuthorization("tenant-b", 8L);
        order.verify(writeLockService).lockRoleAuthorization("tenant-a", 10L);
        order.verify(writeLockService).lockRoleAuthorization("tenant-a", 11L);
        order.verify(writeLockService).lockRoleAuthorization("tenant-a", 12L);
        order.verify(writeLockService).lockGroupAssignment("tenant-a", 5L, 7L);
        order.verify(writeLockService).lockGroupAssignment("tenant-a", 6L, 2L);
        order.verify(writeLockService).lockGroupAssignment("tenant-a", 6L, 9L);
        order.verifyNoMoreInteractions();
    }
}
