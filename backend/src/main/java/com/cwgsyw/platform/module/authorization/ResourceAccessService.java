package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.authorization.dto.ResourceAccessRequest;
import com.cwgsyw.platform.module.authorization.dto.ResourceAccessResponse;
import com.cwgsyw.platform.module.authorization.dto.ResourceAccessResponse.ResourceAclEntryResponse;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.OptimisticLockingFailureException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ResourceAccessService {
    private final JdbcTemplate jdbcTemplate;
    private final ResourceDescriptorRepository descriptorRepository;
    private final AuthorizationService authorizationService;
    private final AuditLogMapper auditLogMapper;
    private final ActiveGroupReferenceValidator activeGroupReferenceValidator;

    public ResourceAccessResponse get(SecurityUser user, String resourceType, Long resourceId) {
        ResourceDescriptor descriptor = requireResource(user, resourceType, resourceId);
        requireManageAccess(user, descriptor);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            SELECT entry_type, subject_type, subject_id, permissions
            FROM resource_acl_entry
            WHERE tenant_id = ? AND resource_type = ? AND resource_id = ? AND NOT is_deleted
            ORDER BY entry_type, subject_type, subject_id
            """, user.getTenantId(), resourceType, resourceId);
        List<ResourceAclEntryResponse> access = rows.stream().filter(row -> "access".equals(row.get("entry_type")))
            .map(this::toResponse).toList();
        List<ResourceAclEntryResponse> defaults = rows.stream().filter(row -> "default".equals(row.get("entry_type")))
            .map(this::toResponse).toList();
        return ResourceAccessResponse.builder()
            .ownerUserId(descriptor.getOwnerUserId()).ownerGroupId(descriptor.getOwnerGroupId())
            .version(descriptor.getAccessVersion())
            .mode(String.format("%04o", descriptor.getPermissionMode()))
            .entries(access).defaultEntries(defaults).build();
    }

    @Transactional
    public ResourceAccessResponse replace(SecurityUser user, String resourceType, Long resourceId,
                                          ResourceAccessRequest request) {
        ResourceDescriptor descriptor = requireResource(user, resourceType, resourceId);
        requireManageAccess(user, descriptor);
        boolean container = isContainer(resourceType);
        if (!container && request.getDefaultEntries() != null && !request.getDefaultEntries().isEmpty()) {
            throw new IllegalArgumentException("非容器资源不支持 default ACL");
        }
        validateOwnerAndSubjects(user.getTenantId(), request);
        int mode = Integer.parseInt(request.getMode(), 8);
        if (!container && (mode & 02000) != 0) throw new IllegalArgumentException("普通资源不支持 setgid");

        String table = table(resourceType);
        int updated = jdbcTemplate.update("UPDATE " + table
            + " SET owner_user_id = ?, owner_group_id = ?, permission_mode = ?,"
            + " access_version = access_version + 1, updated_at = NOW()"
            + " WHERE id = ? AND tenant_id = ? AND access_version = ? AND NOT is_deleted",
            request.getOwnerUserId(), request.getOwnerGroupId(), mode, resourceId, user.getTenantId(),
            request.getVersion());
        if (updated == 0) throw new OptimisticLockingFailureException("资源权限已被其他用户修改，请刷新后重试");
        jdbcTemplate.update("""
            UPDATE resource_acl_entry SET is_deleted = true, deleted_at = NOW(), deleted_by = ?
            WHERE tenant_id = ? AND resource_type = ? AND resource_id = ? AND NOT is_deleted
            """, user.getUserId(), user.getTenantId(), resourceType, resourceId);
        insertEntries(user, resourceType, resourceId, "access", request.getEntries());
        insertEntries(user, resourceType, resourceId, "default", request.getDefaultEntries());
        auditLogMapper.insert(AuditLog.builder().tenantId(user.getTenantId()).module("authorization")
            .action("resource_access_replace").targetId(resourceId).targetType(resourceType)
            .operatorId(user.getUserId()).remark("mode=" + request.getMode())
            .createdAt(LocalDateTime.now()).build());
        return response(user.getTenantId(), resourceType, resourceId, request, mode);
    }

    private void insertEntries(SecurityUser user, String resourceType, Long resourceId,
                               String entryType, List<ResourceAccessRequest.ResourceAclEntryRequest> entries) {
        if (entries == null) return;
        Set<String> subjects = new HashSet<>();
        for (ResourceAccessRequest.ResourceAclEntryRequest entry : entries) {
            String subjectKey = entry.getSubjectType() + ":" + entry.getSubjectId();
            if (!subjects.add(subjectKey)) throw new IllegalArgumentException("ACL 主体重复: " + subjectKey);
            jdbcTemplate.update("""
                INSERT INTO resource_acl_entry
                    (tenant_id, resource_type, resource_id, entry_type, subject_type,
                     subject_id, permissions, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, user.getTenantId(), resourceType, resourceId, entryType,
                entry.getSubjectType(), entry.getSubjectId(), permissionBits(entry.getPermissions()), user.getUserId());
        }
    }

    private void validateOwnerAndSubjects(String tenantId, ResourceAccessRequest request) {
        if (count("SELECT COUNT(*) FROM sys_user WHERE id = ? AND tenant_id = ? AND NOT is_deleted",
                request.getOwnerUserId(), tenantId) == 0) throw new IllegalArgumentException("owner 用户不存在");
        List<ResourceAccessRequest.ResourceAclEntryRequest> all = new java.util.ArrayList<>();
        if (request.getEntries() != null) all.addAll(request.getEntries());
        if (request.getDefaultEntries() != null) all.addAll(request.getDefaultEntries());
        java.util.SortedSet<Long> groupIds = new java.util.TreeSet<>();
        groupIds.add(request.getOwnerGroupId());
        all.stream().filter(entry -> "group".equals(entry.getSubjectType()))
            .map(ResourceAccessRequest.ResourceAclEntryRequest::getSubjectId)
            .forEach(groupIds::add);
        groupIds.forEach(groupId -> activeGroupReferenceValidator.lockAndRequire(tenantId, groupId));
        for (ResourceAccessRequest.ResourceAclEntryRequest entry : all) {
            if ("group".equals(entry.getSubjectType())) continue;
            String table = switch (entry.getSubjectType()) {
                case "user" -> "sys_user";
                case "group" -> "sys_group";
                case "role" -> "sys_role";
                default -> throw new IllegalArgumentException("ACL 主体类型不支持");
            };
            String groupGuard = "sys_group".equals(table) ? " AND group_type <> 'unassigned'" : "";
            if (count("SELECT COUNT(*) FROM " + table
                    + " WHERE id = ? AND tenant_id = ? AND NOT is_deleted" + groupGuard,
                    entry.getSubjectId(), tenantId) == 0) throw new IllegalArgumentException("ACL 主体不存在或跨租户");
        }
    }

    private void requireManageAccess(SecurityUser user, ResourceDescriptor descriptor) {
        String module = descriptor.getResourceType().startsWith("wiki") ? "wiki" : "shared_file";
        String permission = module + ":manage_acl";
        if (!authorizationService.decide(user, permission, descriptor.getResourceType(),
                descriptor.getResourceId(), 2).isAllowed()) {
            throw new AccessDeniedException("仅资源 owner 或管理员可管理权限");
        }
    }

    private ResourceDescriptor requireResource(SecurityUser user, String resourceType, Long resourceId) {
        ResourceDescriptor descriptor = descriptorRepository.find(user.getTenantId(), resourceType, resourceId);
        if (descriptor == null) throw new IllegalArgumentException("资源不存在");
        if (descriptor.getPermissionMode() == null) throw new IllegalStateException("资源尚未完成权限迁移");
        return descriptor;
    }

    private ResourceAclEntryResponse toResponse(Map<String, Object> row) {
        int bits = ((Number) row.get("permissions")).intValue();
        return ResourceAclEntryResponse.builder()
            .entryType(String.valueOf(row.get("entry_type")))
            .subjectType(String.valueOf(row.get("subject_type")))
            .subjectId(((Number) row.get("subject_id")).longValue())
            .permissions(permissionString(bits)).build();
    }

    private ResourceAccessResponse response(String tenantId, String resourceType, Long resourceId,
                                            ResourceAccessRequest request, int mode) {
        ResourceDescriptor descriptor = descriptorRepository.find(tenantId, resourceType, resourceId);
        if (descriptor == null) throw new IllegalStateException("资源权限更新后无法读取资源");
        List<ResourceAclEntryResponse> access = toResponses(request.getEntries(), "access");
        List<ResourceAclEntryResponse> defaults = toResponses(request.getDefaultEntries(), "default");
        return ResourceAccessResponse.builder().ownerUserId(request.getOwnerUserId())
            .ownerGroupId(request.getOwnerGroupId()).version(descriptor.getAccessVersion())
            .mode(String.format("%04o", mode)).entries(access).defaultEntries(defaults).build();
    }

    private List<ResourceAclEntryResponse> toResponses(
            List<ResourceAccessRequest.ResourceAclEntryRequest> entries, String entryType) {
        if (entries == null) return List.of();
        return entries.stream().map(entry -> ResourceAclEntryResponse.builder()
            .entryType(entryType).subjectType(entry.getSubjectType()).subjectId(entry.getSubjectId())
            .permissions(entry.getPermissions()).build()).toList();
    }

    private int permissionBits(String permissions) {
        int bits = 0;
        if (permissions.charAt(0) == 'r') bits |= 4;
        if (permissions.charAt(1) == 'w') bits |= 2;
        if (permissions.charAt(2) == 'x') bits |= 1;
        return bits;
    }

    private String permissionString(int bits) {
        return "%s%s%s".formatted((bits & 4) != 0 ? "r" : "-",
            (bits & 2) != 0 ? "w" : "-", (bits & 1) != 0 ? "x" : "-");
    }

    private boolean isContainer(String resourceType) {
        return List.of("wiki_space", "wiki_page", "shared_folder").contains(resourceType);
    }

    private String table(String resourceType) {
        return switch (resourceType) {
            case "wiki_space" -> "wiki_space";
            case "wiki_page" -> "wiki_page";
            case "shared_folder" -> "shared_folder";
            case "shared_file" -> "shared_file";
            default -> throw new IllegalArgumentException("不支持的资源类型");
        };
    }

    private long count(String sql, Object... args) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }
}
