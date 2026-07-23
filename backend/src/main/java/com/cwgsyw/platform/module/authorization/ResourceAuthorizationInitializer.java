package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.TreeSet;

/** Initializes the authoritative access fields for newly created resources. */
@Service
@RequiredArgsConstructor
public class ResourceAuthorizationInitializer {
    private final JdbcTemplate jdbcTemplate;
    private final ActiveGroupReferenceValidator activeGroupReferenceValidator;

    @Transactional
    public void initialize(String tenantId, String resourceType, Long resourceId,
                           Long ownerUserId, Long ownerGroupId, int permissionMode) {
        ResourceDescriptor parent = parentOf(tenantId, resourceType, resourceId);
        if (ownerGroupId == null && parent != null) {
            ownerGroupId = parent.getOwnerGroupId();
        }
        if (parent != null && parent.getPermissionMode() != null
                && (parent.getPermissionMode() & 02000) != 0) {
            ownerGroupId = parent.getOwnerGroupId();
        }
        TreeSet<Long> groupIds = new TreeSet<>();
        if (ownerGroupId != null) groupIds.add(ownerGroupId);
        if (parent != null) {
            groupIds.addAll(jdbcTemplate.queryForList("""
                SELECT subject_id FROM resource_acl_entry
                WHERE tenant_id = ? AND resource_type = ? AND resource_id = ?
                  AND entry_type = 'default' AND subject_type = 'group' AND NOT is_deleted
                ORDER BY subject_id
                """, Long.class, parent.getTenantId(), parent.getResourceType(), parent.getResourceId()));
        }
        groupIds.forEach(groupId -> activeGroupReferenceValidator.lockAndRequire(tenantId, groupId));
        jdbcTemplate.update("UPDATE " + table(resourceType)
                + " SET owner_user_id = ?, owner_group_id = ?, permission_mode = ? WHERE id = ? AND tenant_id = ?",
            ownerUserId, ownerGroupId, permissionMode, resourceId, tenantId);
        if (parent != null) copyDefaultAcl(parent, resourceType, resourceId, ownerUserId);
    }

    private ResourceDescriptor parentOf(String tenantId, String resourceType, Long resourceId) {
        return switch (resourceType) {
            case "wiki_page" -> jdbcTemplate.query("""
                    SELECT parent_id, space_id FROM wiki_page
                    WHERE id = ? AND tenant_id = ? AND NOT is_deleted
                    """, rs -> {
                        if (!rs.next()) return null;
                        Long parentId = nullableLong(rs.getObject("parent_id"));
                        return parentId == null
                            ? descriptor(tenantId, "wiki_space", rs.getLong("space_id"))
                            : descriptor(tenantId, "wiki_page", parentId);
                    }, resourceId, tenantId);
            case "shared_folder" -> parentByColumn(tenantId, "shared_folder", resourceId,
                "parent_id", "shared_folder");
            case "shared_file" -> parentByColumn(tenantId, "shared_file", resourceId,
                "folder_id", "shared_folder");
            default -> null;
        };
    }

    private ResourceDescriptor parentByColumn(String tenantId, String table, Long resourceId,
                                              String parentColumn, String parentType) {
        Long parentId = jdbcTemplate.query("SELECT " + parentColumn + " FROM " + table
                + " WHERE id = ? AND tenant_id = ? AND NOT is_deleted",
            rs -> rs.next() ? nullableLong(rs.getObject(1)) : null, resourceId, tenantId);
        return parentId == null ? null : descriptor(tenantId, parentType, parentId);
    }

    private ResourceDescriptor descriptor(String tenantId, String resourceType, Long resourceId) {
        return jdbcTemplate.query("SELECT owner_group_id, permission_mode FROM " + table(resourceType)
                + " WHERE id = ? AND tenant_id = ? AND NOT is_deleted",
            rs -> rs.next() ? ResourceDescriptor.builder().tenantId(tenantId).resourceType(resourceType)
                .resourceId(resourceId).ownerGroupId(nullableLong(rs.getObject("owner_group_id")))
                .permissionMode(nullableInteger(rs.getObject("permission_mode"))).build() : null,
            resourceId, tenantId);
    }

    private void copyDefaultAcl(ResourceDescriptor parent, String resourceType, Long resourceId, Long operatorId) {
        jdbcTemplate.update("""
            INSERT INTO resource_acl_entry
                (tenant_id, resource_type, resource_id, entry_type, subject_type,
                 subject_id, permissions, created_by)
            SELECT tenant_id, ?, ?, 'access', subject_type, subject_id, permissions, ?
            FROM resource_acl_entry
            WHERE tenant_id = ? AND resource_type = ? AND resource_id = ?
              AND entry_type = 'default' AND NOT is_deleted
            ON CONFLICT (tenant_id, resource_type, resource_id, entry_type, subject_type, subject_id)
                WHERE NOT is_deleted DO NOTHING
            """, resourceType, resourceId, operatorId, parent.getTenantId(),
            parent.getResourceType(), parent.getResourceId());
    }

    private Long nullableLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private Integer nullableInteger(Object value) {
        return value instanceof Number number ? number.intValue() : null;
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
}
