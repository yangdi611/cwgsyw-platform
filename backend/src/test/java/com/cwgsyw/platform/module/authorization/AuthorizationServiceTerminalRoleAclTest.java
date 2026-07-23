package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.module.authorization.ResourceAclMapper.ResourceAclRow;
import com.cwgsyw.platform.module.authorization.ScopedPermissionMapper.ScopedPermissionRow;
import com.cwgsyw.platform.module.org.UserGroupMembershipMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthorizationServiceTerminalRoleAclTest {
    @Mock ResourceDescriptorRepository resourceRepository;
    @Mock ResourceAclMapper resourceAclMapper;
    @Mock ScopedPermissionMapper scopedPermissionMapper;
    @Mock UserGroupMembershipMapper membershipMapper;
    @Mock UserMapper userMapper;
    @Mock JdbcTemplate jdbcTemplate;
    @Mock BreakGlassService breakGlassService;

    @Test
    void convertedGroupRoleAndRoleAclGrantTheTerminalResourcePermission() {
        SecurityUser user = new SecurityUser(11L, "legacy-auth-user", "", "migration-test", 7L,
            "group", Set.of("wiki:read"));
        ResourceDescriptor resource = ResourceDescriptor.builder()
            .tenantId("migration-test").resourceType("wiki_space").resourceId(21L)
            .ownerUserId(20L).ownerGroupId(7L).permissionMode(0000).accessVersion(0L).build();
        AuthorizationService service = new AuthorizationService(resourceRepository, resourceAclMapper,
            scopedPermissionMapper, membershipMapper, userMapper, jdbcTemplate, breakGlassService);

        when(resourceRepository.find("migration-test", "wiki_space", 21L)).thenReturn(resource);
        when(scopedPermissionMapper.findAssignments("migration-test", 11L, "wiki:read"))
            .thenReturn(List.of(new ScopedPermissionRow(31L, "group", 7L)));
        when(membershipMapper.findEffectiveActiveBusinessGroupIds("migration-test", 11L)).thenReturn(List.of(7L));
        when(resourceAclMapper.findAccessEntries("migration-test", "wiki_space", 21L))
            .thenReturn(List.of(new ResourceAclRow("role", 41L, 4)));
        when(scopedPermissionMapper.findEffectiveRoleIds("migration-test", 11L)).thenReturn(List.of(41L));
        when(scopedPermissionMapper.hasActivePlatformSuperAdminAssignment("migration-test", 11L)).thenReturn(false);

        AuthorizationDecision decision = service.decide(user, "wiki:read", "wiki_space", 21L, 4);

        assertThat(decision.isAllowed()).isTrue();
        assertThat(decision.getMatchedRoleAssignmentId()).isEqualTo(31L);
        assertThat(decision.getResourceClass()).isEqualTo("role_or_group");
        assertThat(decision.getEffectivePermissions()).isEqualTo(4);
    }
}
