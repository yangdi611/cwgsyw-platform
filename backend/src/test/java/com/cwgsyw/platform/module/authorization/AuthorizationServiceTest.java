package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.authorization.ResourceAclMapper.ResourceAclRow;
import com.cwgsyw.platform.module.authorization.ScopedPermissionMapper.ScopedPermissionRow;
import com.cwgsyw.platform.module.org.UserGroupMembershipMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class AuthorizationServiceTest {
    @Mock AuthorizationModeService modeService;
    @Mock ResourceDescriptorRepository resourceRepository;
    @Mock ResourceAclMapper resourceAclMapper;
    @Mock ScopedPermissionMapper scopedPermissionMapper;
    @Mock UserGroupMembershipMapper membershipMapper;
    @Mock UserMapper userMapper;
    @Mock JdbcTemplate jdbcTemplate;
    @Mock BreakGlassService breakGlassService;

    private AuthorizationService service;
    private SecurityUser user;

    @BeforeEach
    void setUp() {
        service = new AuthorizationService(modeService, resourceRepository,
            resourceAclMapper, scopedPermissionMapper, membershipMapper, userMapper, jdbcTemplate, breakGlassService);
        user = new SecurityUser(7L, "tester", "hash", "default", 3L, "group", Set.of("wiki:read"));
    }

    @Test
    void aclCannotBypassMissingFunctionalPermission() {
        ResourceDescriptor resource = resource(8L, 9L, 3L, 0660, null);
        when(resourceRepository.find("default", "wiki_page", 8L)).thenReturn(resource);
        when(scopedPermissionMapper.findAssignments("default", 7L, "wiki:read")).thenReturn(List.of());

        AuthorizationDecision decision = service.decide(user, "wiki:read", "wiki_page", 8L, 4);

        assertFalse(decision.isAllowed());
        assertEquals("FUNCTION_PERMISSION_DENIED", decision.getReasonCode());
    }

    @Test
    void assignmentOutsideResourceScopeReturnsRoleScopeNotCovered() {
        ResourceDescriptor resource = resource(8L, 9L, 4L, 0660, null);
        when(resourceRepository.find("default", "wiki_page", 8L)).thenReturn(resource);
        when(scopedPermissionMapper.findAssignments("default", 7L, "wiki:read"))
            .thenReturn(List.of(new ScopedPermissionRow(20L, "group", 3L)));

        AuthorizationDecision decision = service.decide(user, "wiki:read", "wiki_page", 8L, 4);

        assertFalse(decision.isAllowed());
        assertEquals("ROLE_SCOPE_NOT_COVERED", decision.getReasonCode());
        assertNull(decision.getMatchedRoleAssignmentId());
    }

    @Test
    void coveredAssignmentWithDeniedResourceModeReturnsResourceAccessDenied() {
        ResourceDescriptor resource = resource(8L, 9L, 3L, 0600, null);
        when(resourceRepository.find("default", "wiki_page", 8L)).thenReturn(resource);
        when(scopedPermissionMapper.findAssignments("default", 7L, "wiki:read"))
            .thenReturn(List.of(new ScopedPermissionRow(20L, "group", 3L)));
        when(membershipMapper.findEffectiveActiveBusinessGroupIds("default", 7L)).thenReturn(List.of(3L));
        when(resourceAclMapper.findAccessEntries("default", "wiki_page", 8L)).thenReturn(List.of());
        when(resourceRepository.wikiPageSpaceId("default", 8L)).thenReturn(null);

        AuthorizationDecision decision = service.decide(user, "wiki:read", "wiki_page", 8L, 4);

        assertFalse(decision.isAllowed());
        assertEquals("RESOURCE_ACCESS_DENIED", decision.getReasonCode());
        assertEquals(20L, decision.getMatchedRoleAssignmentId());
        assertEquals("group", decision.getMatchedScopeType());
        assertEquals(3L, decision.getMatchedScopeId());
    }

    @Test
    void groupScopeAndGroupModeAllowRead() {
        ResourceDescriptor resource = resource(8L, 9L, 3L, 0660, null);
        when(resourceRepository.find("default", "wiki_page", 8L)).thenReturn(resource);
        when(scopedPermissionMapper.findAssignments("default", 7L, "wiki:read"))
            .thenReturn(List.of(new ScopedPermissionRow(20L, "group", 3L)));
        when(membershipMapper.findEffectiveActiveBusinessGroupIds("default", 7L)).thenReturn(List.of(3L));
        when(resourceAclMapper.findAccessEntries("default", "wiki_page", 8L)).thenReturn(List.of());
        when(resourceRepository.wikiPageSpaceId("default", 8L)).thenReturn(null);

        AuthorizationDecision decision = service.decide(user, "wiki:read", "wiki_page", 8L, 4);

        assertTrue(decision.isAllowed());
        assertEquals("group", decision.getResourceClass());
    }

    @Test
    void namedUserAclDoesNotFallBackToOthers() {
        ResourceDescriptor resource = resource(8L, 9L, 4L, 0004, null);
        resource.setResourceType("shared_file");
        when(resourceRepository.find("default", "shared_file", 8L)).thenReturn(resource);
        when(scopedPermissionMapper.findAssignments("default", 7L, "shared_file:read"))
            .thenReturn(List.of(new ScopedPermissionRow(20L, "tenant", null)));
        when(membershipMapper.findEffectiveActiveBusinessGroupIds("default", 7L)).thenReturn(List.of(3L));
        when(resourceAclMapper.findAccessEntries("default", "shared_file", 8L))
            .thenReturn(List.of(new ResourceAclRow("user", 7L, 0)));

        AuthorizationDecision decision = service.decide(user, "shared_file:read", "shared_file", 8L, 4);

        assertFalse(decision.isAllowed());
        assertEquals("named_user", decision.getResourceClass());
    }

    @Test
    void missingAncestorTraverseDeniesPageRead() {
        ResourceDescriptor page = resource(8L, 9L, 3L, 0660, null);
        ResourceDescriptor space = ResourceDescriptor.builder().tenantId("default").resourceType("wiki_space")
            .resourceId(2L).ownerUserId(9L).ownerGroupId(3L).permissionMode(0660).build();
        when(resourceRepository.find("default", "wiki_page", 8L)).thenReturn(page);
        when(resourceRepository.wikiPageSpaceId("default", 8L)).thenReturn(2L);
        when(resourceRepository.find("default", "wiki_space", 2L)).thenReturn(space);
        when(scopedPermissionMapper.findAssignments("default", 7L, "wiki:read"))
            .thenReturn(List.of(new ScopedPermissionRow(20L, "group", 3L)));
        when(membershipMapper.findEffectiveActiveBusinessGroupIds("default", 7L)).thenReturn(List.of(3L));
        when(resourceAclMapper.findAccessEntries("default", "wiki_space", 2L)).thenReturn(List.of());

        AuthorizationDecision decision = service.decide(user, "wiki:read", "wiki_page", 8L, 4);

        assertFalse(decision.isAllowed());
        assertEquals("ANCESTOR_TRAVERSE_DENIED", decision.getReasonCode());
    }

    @Test
    void activeBreakGlassBypassesOnlyResourceDenial() {
        user = new SecurityUser(7L, "tester", "hash", "default", 3L, "platform", Set.of("wiki:read"));
        user.setSessionId("session-1");
        ResourceDescriptor resource = resource(8L, 9L, 4L, 0600, null);
        when(resourceRepository.find("default", "wiki_page", 8L)).thenReturn(resource);
        when(scopedPermissionMapper.findAssignments("default", 7L, "wiki:read"))
            .thenReturn(List.of(new ScopedPermissionRow(20L, "platform", null)));
        when(membershipMapper.findEffectiveActiveBusinessGroupIds("default", 7L)).thenReturn(List.of());
        when(resourceAclMapper.findAccessEntries("default", "wiki_page", 8L)).thenReturn(List.of());
        when(resourceRepository.wikiPageSpaceId("default", 8L)).thenReturn(null);
        when(breakGlassService.isActive(user)).thenReturn(true);

        AuthorizationDecision decision = service.decide(user, "wiki:read", "wiki_page", 8L, 4);

        assertTrue(decision.isAllowed());
        assertEquals("BREAK_GLASS_ALLOWED", decision.getReasonCode());
        verify(breakGlassService).auditBypass(user, "wiki:read", "wiki_page", 8L,
            "RESOURCE_ACCESS_DENIED");
    }

    @Test
    void breakGlassCannotBypassMissingFunctionalPermission() {
        user = new SecurityUser(7L, "tester", "hash", "default", 3L, "platform", Set.of());
        user.setSessionId("session-1");
        when(resourceRepository.find("default", "wiki_page", 8L))
            .thenReturn(resource(8L, 9L, 4L, 0600, null));
        when(scopedPermissionMapper.findAssignments("default", 7L, "wiki:read")).thenReturn(List.of());

        AuthorizationDecision decision = service.decide(user, "wiki:read", "wiki_page", 8L, 4);

        assertFalse(decision.isAllowed());
        assertEquals("FUNCTION_PERMISSION_DENIED", decision.getReasonCode());
    }

    @Test
    void legacyRequestDenialUsesStableResourceErrorCode() {
        when(modeService.effectiveMode("default")).thenReturn(AuthorizationModeService.EffectiveMode.LEGACY);
        BusinessException exception = assertThrows(BusinessException.class,
            () -> service.requireWithCompatibility(user, "wiki", "wiki:read",
                "wiki_page", 8L, 4, false));

        assertEquals(403, exception.getHttpStatus());
        assertEquals("RESOURCE_ACCESS_DENIED", exception.getErrorCode());
    }

    @Test
    void enforcedResourceDecisionIgnoresLegacyAllow() {
        when(modeService.effectiveMode("default")).thenReturn(AuthorizationModeService.EffectiveMode.ENFORCED);
        when(resourceRepository.find("default", "wiki_page", 8L))
            .thenReturn(resource(8L, 9L, 3L, 0660, null));
        when(scopedPermissionMapper.findAssignments("default", 7L, "wiki:read")).thenReturn(List.of());

        assertFalse(service.decideWithCompatibility(user, "wiki", "wiki:read",
            "wiki_page", 8L, 4, true));
    }

    @Test
    void enforcedResourceDecisionDoesNotEvaluateLegacySupplier() {
        when(modeService.effectiveMode("default")).thenReturn(AuthorizationModeService.EffectiveMode.ENFORCED);
        when(resourceRepository.find("default", "wiki_page", 8L))
            .thenReturn(resource(8L, 9L, 3L, 0660, null));
        when(scopedPermissionMapper.findAssignments("default", 7L, "wiki:read")).thenReturn(List.of());

        java.util.concurrent.atomic.AtomicBoolean legacyEvaluated = new java.util.concurrent.atomic.AtomicBoolean();
        assertFalse(service.decideWithCompatibility(user, "wiki", "wiki:read", "wiki_page", 8L, 4,
            () -> {
                legacyEvaluated.set(true);
                return true;
            }));

        assertFalse(legacyEvaluated.get());
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void shadowPolicyDenialRecordsConstrainedDecision() {
        when(modeService.effectiveMode("default")).thenReturn(AuthorizationModeService.EffectiveMode.SHADOW);

        assertFalse(service.decideWithPolicyCompatibility(user, "wiki", "wiki:create",
            "wiki_space", 5L, 3, false, false));

        verify(jdbcTemplate).update(anyString(), eq("default"), eq(7L), eq("wiki"), eq("wiki:create"),
            eq("wiki_space"), eq(5L), eq(false), eq(false), eq("RESOURCE_POLICY_DENIED"));
        verifyNoInteractions(resourceRepository, scopedPermissionMapper);
    }

    @Test
    void enforcedPolicyDenialCannotBeBypassedByAuthorizationDecision() {
        when(modeService.effectiveMode("default")).thenReturn(AuthorizationModeService.EffectiveMode.ENFORCED);

        assertFalse(service.decideWithPolicyCompatibility(user, "wiki", "wiki:create",
            "wiki_space", 5L, 3, false, true));

        verifyNoInteractions(resourceRepository, scopedPermissionMapper, jdbcTemplate);
    }

    private ResourceDescriptor resource(Long id, Long ownerId, Long groupId, int mode, Long parentId) {
        return ResourceDescriptor.builder().tenantId("default").resourceType("wiki_page")
            .resourceId(id).ownerUserId(ownerId).ownerGroupId(groupId)
            .permissionMode(mode).parentId(parentId).build();
    }
}
