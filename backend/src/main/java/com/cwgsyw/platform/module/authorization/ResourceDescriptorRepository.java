package com.cwgsyw.platform.module.authorization;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Map;

@Repository
@RequiredArgsConstructor
public class ResourceDescriptorRepository {
    private final JdbcTemplate jdbcTemplate;

    public ResourceDescriptor find(String tenantId, String resourceType, Long resourceId) {
        ResourceQuery query = ResourceQuery.of(resourceType);
        return jdbcTemplate.query("""
                SELECT tenant_id, owner_user_id, owner_group_id, permission_mode, access_version,
                       %s AS parent_id, %s AS access_restricted
                FROM %s WHERE id = ? AND tenant_id = ? AND NOT is_deleted
                """.formatted(query.parentExpression(), query.accessRestrictedExpression(), query.table()),
            rs -> rs.next() ? ResourceDescriptor.builder()
                .tenantId(rs.getString("tenant_id"))
                .resourceType(resourceType)
                .resourceId(resourceId)
                .ownerUserId(nullableLong(rs.getObject("owner_user_id")))
                .ownerGroupId(nullableLong(rs.getObject("owner_group_id")))
                .permissionMode(nullableInteger(rs.getObject("permission_mode")))
                .accessVersion(nullableLong(rs.getObject("access_version")))
                .parentId(nullableLong(rs.getObject("parent_id")))
                .accessRestricted(rs.getBoolean("access_restricted"))
                .build() : null,
            resourceId, tenantId);
    }

    public Long wikiPageSpaceId(String tenantId, Long pageId) {
        return jdbcTemplate.query("""
                SELECT space_id FROM wiki_page
                WHERE id = ? AND tenant_id = ? AND NOT is_deleted
            """, rs -> rs.next() ? rs.getLong(1) : null, pageId, tenantId);
    }

    public boolean isWritableSystemWikiResource(String tenantId, String resourceType, Long resourceId) {
        String sql = switch (resourceType) {
            case "wiki_space" -> """
                SELECT EXISTS (
                    SELECT 1 FROM wiki_space
                    WHERE id = ? AND tenant_id = ? AND NOT is_deleted
                      AND seed_key IS NOT NULL AND write_scope = 'all'
                )
                """;
            case "wiki_page" -> """
                SELECT EXISTS (
                    SELECT 1 FROM wiki_page page
                    JOIN wiki_space space ON space.id = page.space_id AND space.tenant_id = page.tenant_id
                    WHERE page.id = ? AND page.tenant_id = ? AND NOT page.is_deleted AND NOT space.is_deleted
                      AND space.seed_key IS NOT NULL AND space.write_scope = 'all'
                )
                """;
            default -> null;
        };
        if (sql == null) return false;
        Boolean result = jdbcTemplate.queryForObject(sql, Boolean.class, resourceId, tenantId);
        return Boolean.TRUE.equals(result);
    }

    private Long nullableLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private Integer nullableInteger(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }

    private record ResourceQuery(String table, String parentExpression, String accessRestrictedExpression) {
        private static final Map<String, ResourceQuery> QUERIES = Map.of(
            "wiki_space", new ResourceQuery("wiki_space", "NULL::BIGINT", "FALSE"),
            "wiki_page", new ResourceQuery("wiki_page", "parent_id", "NOT COALESCE(acl_inherited, TRUE)"),
            "shared_folder", new ResourceQuery("shared_folder", "parent_id", "FALSE"),
            "shared_file", new ResourceQuery("shared_file", "folder_id", "FALSE")
        );

        private static ResourceQuery of(String resourceType) {
            ResourceQuery query = QUERIES.get(resourceType);
            if (query == null) throw new IllegalArgumentException("不支持的资源类型");
            return query;
        }
    }
}
