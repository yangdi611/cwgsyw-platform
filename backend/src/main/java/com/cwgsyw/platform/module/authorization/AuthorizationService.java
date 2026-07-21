package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.authorization.ResourceAclMapper.ResourceAclRow;
import com.cwgsyw.platform.module.authorization.ScopedPermissionMapper.ScopedPermissionRow;
import com.cwgsyw.platform.module.org.UserGroupMembershipMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.BooleanSupplier;

@Service
@RequiredArgsConstructor
public class AuthorizationService {
    private static final int MAX_PARENT_DEPTH = 64;

    private final AuthorizationModeService modeService;
    private final ResourceDescriptorRepository resourceRepository;
    private final ResourceAclMapper resourceAclMapper;
    private final ScopedPermissionMapper scopedPermissionMapper;
    private final UserGroupMembershipMapper membershipMapper;
    private final UserMapper userMapper;
    private final JdbcTemplate jdbcTemplate;
    private final BreakGlassService breakGlassService;

    public boolean isEnforced(SecurityUser user, String module) {
        return modeService.isEnforced(user.getTenantId());
    }

    public String rolloutState(SecurityUser user, String module) {
        return modeService.effectiveMode(user.getTenantId()).name().toLowerCase();
    }

    public AuthorizationDecision decide(SecurityUser user, String permissionCode,
                                        String resourceType, Long resourceId, int requiredBits) {
        AuthorizationDecision ordinary = decideOrdinary(user, permissionCode, resourceType, resourceId, requiredBits);
        if (ordinary.isAllowed() || !canBypassResourceDenial(ordinary) || !breakGlassService.isActive(user)) {
            return ordinary;
        }
        breakGlassService.auditBypass(user, permissionCode, resourceType, resourceId, ordinary.getReasonCode());
        return AuthorizationDecision.builder().allowed(true).reasonCode("BREAK_GLASS_ALLOWED")
            .resourceClass("break_glass").effectivePermissions(7).build();
    }

    private AuthorizationDecision decideOrdinary(SecurityUser user, String permissionCode,
                                                  String resourceType, Long resourceId, int requiredBits) {
        ResourceDescriptor resource = resourceRepository.find(user.getTenantId(), resourceType, resourceId);
        if (resource == null) return denied("RESOURCE_NOT_FOUND");
        if (resource.getOwnerUserId() == null || resource.getOwnerGroupId() == null
                || resource.getPermissionMode() == null) {
            return denied("RESOURCE_NOT_MIGRATED");
        }

        List<ScopedPermissionRow> assignments = scopedPermissionMapper.findAssignments(
            user.getTenantId(), user.getUserId(), permissionCode);
        ScopedPermissionRow assignment = assignments.stream()
            .filter(row -> scopeCovers(user, row, resource))
            .findFirst().orElse(null);
        if (assignment == null) return denied(assignments.isEmpty()
            ? "FUNCTION_PERMISSION_DENIED" : "ROLE_SCOPE_NOT_COVERED");

        Set<Long> groupIds = effectiveGroupIds(user);
        AuthorizationDecision traverseFailure = checkAncestors(user, resource, groupIds);
        if (traverseFailure != null) return traverseFailure;
        PermissionMatch match = resourcePermissions(user, resource, groupIds, requiredBits);
        if ((match.permissions() & requiredBits) != requiredBits) {
            return AuthorizationDecision.builder()
                .allowed(false).reasonCode("RESOURCE_ACCESS_DENIED")
                .matchedRoleAssignmentId(assignment.id())
                .matchedScopeType(assignment.scopeType()).matchedScopeId(assignment.scopeId())
                .resourceClass(match.resourceClass()).effectivePermissions(match.permissions()).build();
        }
        return AuthorizationDecision.builder()
            .allowed(true).reasonCode("ALLOWED")
            .matchedRoleAssignmentId(assignment.id())
            .matchedScopeType(assignment.scopeType()).matchedScopeId(assignment.scopeId())
            .resourceClass(match.resourceClass()).effectivePermissions(match.permissions()).build();
    }

    public AuthorizationDecision decideCreate(SecurityUser user, String permissionCode, Long ownerGroupId) {
        List<ScopedPermissionRow> assignments = scopedPermissionMapper.findAssignments(
            user.getTenantId(), user.getUserId(), permissionCode);
        ScopedPermissionRow assignment = assignments.stream()
            .filter(row -> "platform".equals(row.scopeType()) || "tenant".equals(row.scopeType())
                || ("group".equals(row.scopeType()) && Objects.equals(row.scopeId(), ownerGroupId)))
            .findFirst().orElse(null);
        if (assignment == null) return denied(assignments.isEmpty()
            ? "FUNCTION_PERMISSION_DENIED" : "ROLE_SCOPE_NOT_COVERED");
        if (ownerGroupId == null && "group".equals(assignment.scopeType())) {
            return denied("RESOURCE_GROUP_REQUIRED");
        }
        return AuthorizationDecision.builder().allowed(true).reasonCode("ALLOWED")
            .matchedRoleAssignmentId(assignment.id()).matchedScopeType(assignment.scopeType())
            .matchedScopeId(assignment.scopeId()).build();
    }

    public boolean decideCreateWithCompatibility(SecurityUser user, String module, String permissionCode,
                                                 Long ownerGroupId, boolean legacyAllowed) {
        return decideCreateWithCompatibility(user, module, permissionCode, ownerGroupId, () -> legacyAllowed);
    }

    public boolean decideCreateWithCompatibility(SecurityUser user, String module, String permissionCode,
                                                 Long ownerGroupId, BooleanSupplier legacyAllowed) {
        AuthorizationModeService.EffectiveMode mode = modeService.effectiveMode(user.getTenantId());
        if (mode == AuthorizationModeService.EffectiveMode.LEGACY) return legacyAllowed.getAsBoolean();
        AuthorizationDecision decision = decideCreate(user, permissionCode, ownerGroupId);
        if (mode == AuthorizationModeService.EffectiveMode.ENFORCED) return decision.isAllowed();
        boolean legacyDecision = legacyAllowed.getAsBoolean();
        jdbcTemplate.update("""
            INSERT INTO authorization_decision_diff
                (tenant_id, user_id, module, permission_code, resource_type, resource_id,
                 legacy_allowed, new_allowed, new_reason_code)
            VALUES (?, ?, ?, ?, 'create', 0, ?, ?, ?)
            """, user.getTenantId(), user.getUserId(), module, permissionCode,
            legacyDecision, decision.isAllowed(), decision.getReasonCode());
        return legacyDecision;
    }

    public boolean canUseOwnerGroup(SecurityUser user, Long ownerGroupId) {
        if (ownerGroupId == null) return false;
        Long eligibleGroup = jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM sys_group
            WHERE id = ? AND tenant_id = ? AND NOT is_deleted AND group_type <> 'unassigned'
            """, Long.class, ownerGroupId, user.getTenantId());
        if (eligibleGroup == null || eligibleGroup == 0) return false;
        if ("tenant".equals(user.getGroupScope()) || "platform".equals(user.getGroupScope())) return true;
        return Objects.equals(user.getGroupId(), ownerGroupId)
            || membershipMapper.findActiveGroupIds(user.getTenantId(), user.getUserId()).contains(ownerGroupId);
    }

    public boolean decideWithCompatibility(SecurityUser user, String module, String permissionCode,
                                           String resourceType, Long resourceId, int requiredBits,
                                           boolean legacyAllowed) {
        return decideWithCompatibility(user, module, permissionCode, resourceType, resourceId,
            requiredBits, () -> legacyAllowed);
    }

    public boolean decideWithCompatibility(SecurityUser user, String module, String permissionCode,
                                           String resourceType, Long resourceId, int requiredBits,
                                           BooleanSupplier legacyAllowed) {
        AuthorizationModeService.EffectiveMode mode = modeService.effectiveMode(user.getTenantId());
        if (mode == AuthorizationModeService.EffectiveMode.LEGACY) return legacyAllowed.getAsBoolean();
        AuthorizationDecision decision = decide(user, permissionCode, resourceType, resourceId, requiredBits);
        if (mode == AuthorizationModeService.EffectiveMode.ENFORCED) return decision.isAllowed();
        boolean legacyDecision = legacyAllowed.getAsBoolean();
        jdbcTemplate.update("""
            INSERT INTO authorization_decision_diff
                (tenant_id, user_id, module, permission_code, resource_type, resource_id,
                 legacy_allowed, new_allowed, new_reason_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, user.getTenantId(), user.getUserId(), module, permissionCode, resourceType, resourceId,
            legacyDecision, decision.isAllowed(), decision.getReasonCode());
        return legacyDecision;
    }

    public boolean decideWithPolicyCompatibility(SecurityUser user, String module, String permissionCode,
                                                 String resourceType, Long resourceId, int requiredBits,
                                                 boolean policyAllowed, boolean legacyAllowed) {
        return decideWithPolicyCompatibility(user, module, permissionCode, resourceType, resourceId,
            requiredBits, policyAllowed, () -> legacyAllowed);
    }

    public boolean decideWithPolicyCompatibility(SecurityUser user, String module, String permissionCode,
                                                 String resourceType, Long resourceId, int requiredBits,
                                                 boolean policyAllowed, BooleanSupplier legacyAllowed) {
        AuthorizationModeService.EffectiveMode mode = modeService.effectiveMode(user.getTenantId());
        if (mode == AuthorizationModeService.EffectiveMode.LEGACY) return legacyAllowed.getAsBoolean();
        AuthorizationDecision decision = policyAllowed
            ? AuthorizationDecision.builder().allowed(true).reasonCode("RESOURCE_POLICY_ALLOWED")
                .resourceClass("policy").effectivePermissions(7).build()
            : denied("RESOURCE_POLICY_DENIED");
        if (mode == AuthorizationModeService.EffectiveMode.ENFORCED) return decision.isAllowed();
        boolean legacyDecision = legacyAllowed.getAsBoolean();
        jdbcTemplate.update("""
            INSERT INTO authorization_decision_diff
                (tenant_id, user_id, module, permission_code, resource_type, resource_id,
                 legacy_allowed, new_allowed, new_reason_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, user.getTenantId(), user.getUserId(), module, permissionCode, resourceType, resourceId,
            legacyDecision, decision.isAllowed(), decision.getReasonCode());
        return legacyDecision;
    }

    public void requireWithCompatibility(SecurityUser user, String module, String permissionCode,
                                         String resourceType, Long resourceId, int requiredBits,
                                         boolean legacyAllowed) {
        requireWithCompatibility(user, module, permissionCode, resourceType, resourceId,
            requiredBits, () -> legacyAllowed);
    }

    public void requireWithCompatibility(SecurityUser user, String module, String permissionCode,
                                         String resourceType, Long resourceId, int requiredBits,
                                         BooleanSupplier legacyAllowed) {
        AuthorizationModeService.EffectiveMode mode = modeService.effectiveMode(user.getTenantId());
        if (mode == AuthorizationModeService.EffectiveMode.LEGACY) {
            if (!legacyAllowed.getAsBoolean()) {
                throw BusinessException.forbidden("RESOURCE_ACCESS_DENIED", "无权限");
            }
            return;
        }

        AuthorizationDecision decision = decide(user, permissionCode, resourceType, resourceId, requiredBits);
        if (mode == AuthorizationModeService.EffectiveMode.ENFORCED) {
            if (!decision.isAllowed()) {
                throw BusinessException.forbidden(decision.getReasonCode(), "无权限");
            }
            return;
        }

        boolean legacyDecision = legacyAllowed.getAsBoolean();
        jdbcTemplate.update("""
            INSERT INTO authorization_decision_diff
                (tenant_id, user_id, module, permission_code, resource_type, resource_id,
                 legacy_allowed, new_allowed, new_reason_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, user.getTenantId(), user.getUserId(), module, permissionCode, resourceType, resourceId,
            legacyDecision, decision.isAllowed(), decision.getReasonCode());
        if (!legacyDecision) throw BusinessException.forbidden("RESOURCE_ACCESS_DENIED", "无权限");
    }

    public boolean decideParentWithCompatibility(SecurityUser user, String module, String permissionCode,
                                                 String resourceType, Long resourceId, int requiredBits,
                                                 boolean legacyAllowed) {
        return decideParentWithCompatibility(user, module, permissionCode, resourceType, resourceId,
            requiredBits, () -> legacyAllowed);
    }

    public boolean decideParentWithCompatibility(SecurityUser user, String module, String permissionCode,
                                                 String resourceType, Long resourceId, int requiredBits,
                                                 BooleanSupplier legacyAllowed) {
        if (modeService.effectiveMode(user.getTenantId()) == AuthorizationModeService.EffectiveMode.LEGACY) {
            return legacyAllowed.getAsBoolean();
        }
        ResourceDescriptor resource = resourceRepository.find(user.getTenantId(), resourceType, resourceId);
        ResourceDescriptor target = resource == null ? null : parent(resource);
        if (target == null) target = resource;
        if (target == null) return decideWithCompatibility(user, module, permissionCode,
            resourceType, resourceId, requiredBits, legacyAllowed);
        return decideWithCompatibility(user, module, permissionCode, target.getResourceType(),
            target.getResourceId(), requiredBits, legacyAllowed);
    }

    public void requireParentWithCompatibility(SecurityUser user, String module, String permissionCode,
                                               String resourceType, Long resourceId, int requiredBits,
                                               boolean legacyAllowed) {
        requireParentWithCompatibility(user, module, permissionCode, resourceType, resourceId,
            requiredBits, () -> legacyAllowed);
    }

    public void requireParentWithCompatibility(SecurityUser user, String module, String permissionCode,
                                               String resourceType, Long resourceId, int requiredBits,
                                               BooleanSupplier legacyAllowed) {
        if (!decideParentWithCompatibility(user, module, permissionCode, resourceType, resourceId,
                requiredBits, legacyAllowed)) {
            throw BusinessException.forbidden("RESOURCE_ACCESS_DENIED", "无权限");
        }
    }

    private boolean scopeCovers(SecurityUser user, ScopedPermissionRow assignment, ResourceDescriptor resource) {
        if ("platform".equals(assignment.scopeType()) || "tenant".equals(assignment.scopeType())) return true;
        if (isWritableSystemWikiDocumentAdmin(user, resource)) return true;
        if (isSharedFileTenantAdministrator(user, resource)) return true;
        return "group".equals(assignment.scopeType())
            && Objects.equals(assignment.scopeId(), resource.getOwnerGroupId());
    }

    private Set<Long> effectiveGroupIds(SecurityUser user) {
        return new HashSet<>(membershipMapper.findEffectiveActiveBusinessGroupIds(
            user.getTenantId(), user.getUserId()));
    }

    private AuthorizationDecision checkAncestors(SecurityUser user, ResourceDescriptor resource,
                                                 Set<Long> groupIds) {
        ResourceDescriptor current = parent(resource);
        Set<String> visited = new HashSet<>();
        int depth = 0;
        while (current != null) {
            String key = current.getResourceType() + ":" + current.getResourceId();
            if (!visited.add(key) || ++depth > MAX_PARENT_DEPTH) return denied("RESOURCE_PARENT_CYCLE");
            PermissionMatch match = resourcePermissions(user, current, groupIds, 1);
            if ((match.permissions() & 1) == 0) return denied("ANCESTOR_TRAVERSE_DENIED");
            current = parent(current);
        }
        return null;
    }

    private ResourceDescriptor parent(ResourceDescriptor resource) {
        if ("wiki_page".equals(resource.getResourceType())) {
            if (resource.getParentId() != null) {
                return resourceRepository.find(resource.getTenantId(), "wiki_page", resource.getParentId());
            }
            Long spaceId = resourceRepository.wikiPageSpaceId(resource.getTenantId(), resource.getResourceId());
            return spaceId == null ? null : resourceRepository.find(resource.getTenantId(), "wiki_space", spaceId);
        }
        if ("shared_file".equals(resource.getResourceType())) {
            return resource.getParentId() == null ? null
                : resourceRepository.find(resource.getTenantId(), "shared_folder", resource.getParentId());
        }
        if ("shared_folder".equals(resource.getResourceType()) && resource.getParentId() != null) {
            return resourceRepository.find(resource.getTenantId(), "shared_folder", resource.getParentId());
        }
        return null;
    }

    private PermissionMatch resourcePermissions(SecurityUser user, ResourceDescriptor resource,
                                                Set<Long> groupIds, int requiredBits) {
        if (isPlatformSuperAdmin(user, resource)) return new PermissionMatch("platform_super_admin", 7);
        if (isWritableSystemWikiDocumentAdmin(user, resource)) return new PermissionMatch("document_admin", 7);
        if (isSharedFileTenantAdministrator(user, resource)) return new PermissionMatch("tenant_admin", 7);
        int mode = resource.getPermissionMode();
        List<ResourceAclRow> entries = resourceAclMapper.findAccessEntries(
            resource.getTenantId(), resource.getResourceType(), resource.getResourceId());
        ResourceAclRow namedUser = entries.stream()
            .filter(entry -> "user".equals(entry.subjectType())
                && Objects.equals(entry.subjectId(), user.getUserId()))
            .findFirst().orElse(null);
        if (namedUser != null) return new PermissionMatch("named_user", namedUser.permissions());

        if (!resource.isAccessRestricted() && Objects.equals(user.getUserId(), resource.getOwnerUserId())) {
            return new PermissionMatch("owner", (mode >> 6) & 7);
        }

        int groupPermissions = 0;
        boolean groupMatched = false;
        if (!resource.isAccessRestricted() && resource.getOwnerGroupId() != null
                && groupIds.contains(resource.getOwnerGroupId())) {
            groupMatched = true;
            groupPermissions |= (mode >> 3) & 7;
        }
        for (ResourceAclRow entry : entries) {
            if ("group".equals(entry.subjectType()) && groupIds.contains(entry.subjectId())) {
                groupMatched = true;
                groupPermissions |= entry.permissions();
            }
        }
        if ("wiki_page".equals(resource.getResourceType()) && (requiredBits & 2) != 0) {
            Long spaceId = resourceRepository.wikiPageSpaceId(resource.getTenantId(), resource.getResourceId());
            if (spaceId != null) {
                for (ResourceAclRow entry : resourceAclMapper.findAccessEntries(
                        resource.getTenantId(), "wiki_space", spaceId)) {
                    if ("group".equals(entry.subjectType()) && groupIds.contains(entry.subjectId())) {
                        groupMatched = true;
                        groupPermissions |= entry.permissions();
                    }
                }
            }
        }
        if (groupMatched) return new PermissionMatch("group", groupPermissions);
        if (resource.isAccessRestricted()) return new PermissionMatch("restricted", 0);
        return new PermissionMatch("others", mode & 7);
    }

    private boolean isPlatformSuperAdmin(SecurityUser user, ResourceDescriptor resource) {
        return (resource.getResourceType().startsWith("wiki")
            || "shared_file".equals(resource.getResourceType())
            || "shared_folder".equals(resource.getResourceType()))
            && scopedPermissionMapper.hasActivePlatformSuperAdminAssignment(user.getTenantId(), user.getUserId());
    }

    private boolean isWritableSystemWikiDocumentAdmin(SecurityUser user, ResourceDescriptor resource) {
        return resource.getResourceType().startsWith("wiki")
            && resourceRepository.isWritableSystemWikiResource(user.getTenantId(), resource.getResourceType(),
                resource.getResourceId())
            && scopedPermissionMapper.hasActiveDocumentAdminAssignment(user.getTenantId(), user.getUserId());
    }

    private boolean isSharedFileTenantAdministrator(SecurityUser user, ResourceDescriptor resource) {
        return ("shared_folder".equals(resource.getResourceType())
            || "shared_file".equals(resource.getResourceType()))
            && scopedPermissionMapper.hasActiveTenantAdminAssignment(user.getTenantId(), user.getUserId());
    }

    private AuthorizationDecision denied(String reasonCode) {
        return AuthorizationDecision.builder().allowed(false).reasonCode(reasonCode).build();
    }

    private boolean canBypassResourceDenial(AuthorizationDecision decision) {
        return List.of("RESOURCE_ACCESS_DENIED", "ANCESTOR_TRAVERSE_DENIED").contains(decision.getReasonCode());
    }

    private record PermissionMatch(String resourceClass, int permissions) {}
}
