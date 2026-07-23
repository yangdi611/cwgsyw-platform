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

@Service
@RequiredArgsConstructor
public class AuthorizationService {
    private static final int MAX_PARENT_DEPTH = 64;

    private final ResourceDescriptorRepository resourceRepository;
    private final ResourceAclMapper resourceAclMapper;
    private final ScopedPermissionMapper scopedPermissionMapper;
    private final UserGroupMembershipMapper membershipMapper;
    private final UserMapper userMapper;
    private final JdbcTemplate jdbcTemplate;
    private final BreakGlassService breakGlassService;

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

    public boolean decideParent(SecurityUser user, String permissionCode,
                                String resourceType, Long resourceId, int requiredBits) {
        ResourceDescriptor resource = resourceRepository.find(user.getTenantId(), resourceType, resourceId);
        ResourceDescriptor target = resource == null ? null : parent(resource);
        if (target == null) target = resource;
        if (target == null) return false;
        return decide(user, permissionCode, target.getResourceType(), target.getResourceId(), requiredBits)
            .isAllowed();
    }

    public void require(SecurityUser user, String permissionCode,
                        String resourceType, Long resourceId, int requiredBits) {
        AuthorizationDecision decision = decide(user, permissionCode, resourceType, resourceId, requiredBits);
        if (!decision.isAllowed()) {
            throw BusinessException.forbidden(decision.getReasonCode(), "无权限");
        }
    }

    public void requireParent(SecurityUser user, String permissionCode,
                              String resourceType, Long resourceId, int requiredBits) {
        if (!decideParent(user, permissionCode, resourceType, resourceId, requiredBits)) {
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

        Set<Long> roleIds = new HashSet<>(scopedPermissionMapper.findEffectiveRoleIds(
            user.getTenantId(), user.getUserId()));
        int rolePermissions = entries.stream()
            .filter(entry -> "role".equals(entry.subjectType()) && roleIds.contains(entry.subjectId()))
            .mapToInt(ResourceAclRow::permissions)
            .reduce(0, (left, right) -> left | right);

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
        if (groupMatched || rolePermissions != 0) {
            return new PermissionMatch(rolePermissions != 0 ? "role_or_group" : "group",
                groupPermissions | rolePermissions);
        }
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
