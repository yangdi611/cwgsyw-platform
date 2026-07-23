-- Authorization end state: migrate the only remaining legacy relationships into the
-- authoritative assignment/ACL tables, then remove shadow and rollback schema.

ALTER TABLE resource_acl_entry
    DROP CONSTRAINT IF EXISTS ck_resource_acl_subject_type;
ALTER TABLE resource_acl_entry
    ADD CONSTRAINT ck_resource_acl_subject_type
        CHECK (subject_type IN ('user', 'group', 'role'));

-- V1 users stored their primary business group directly on sys_user, whereas
-- terminal group-scoped authorization resolves memberships exclusively through
-- sys_user_group_membership. Materialize only missing active memberships before
-- converting legacy group-scoped role links, without replacing an existing
-- primary membership selected by the current system.
INSERT INTO sys_user_group_membership
    (tenant_id, user_id, group_id, membership_role, is_primary, origin_type,
     origin_key, created_at, updated_at)
SELECT u.tenant_id,
       u.id,
       u.group_id,
       CASE WHEN g.leader_id = u.id THEN 'leader' ELSE 'member' END,
       NOT EXISTS (
           SELECT 1
           FROM sys_user_group_membership existing_primary
           WHERE existing_primary.tenant_id = u.tenant_id
             AND existing_primary.user_id = u.id
             AND existing_primary.is_primary
             AND NOT existing_primary.is_deleted
       ),
       'migration',
       'legacy-primary-group:' || u.id,
       NOW(),
       NOW()
FROM sys_user u
JOIN sys_group g ON g.id = u.group_id AND g.tenant_id = u.tenant_id
    AND NOT g.is_deleted AND g.group_type = 'business'
WHERE NOT u.is_deleted
ON CONFLICT (tenant_id, user_id, group_id) WHERE NOT is_deleted DO NOTHING;

-- Every legacy role link becomes one active scoped assignment. Group-scoped roles
-- require an active primary business group; all other roles retain their declared scope.
INSERT INTO sys_role_assignment
    (tenant_id, user_id, role_id, scope_type, scope_id, origin_type, created_by, created_at, updated_at)
SELECT u.tenant_id,
       u.id,
       r.id,
       CASE WHEN r.scope = 'group' THEN 'group' ELSE r.scope END,
       CASE WHEN r.scope = 'group' THEN u.group_id ELSE NULL END,
       'migration',
       NULL,
       NOW(),
       NOW()
FROM sys_user_role legacy
JOIN sys_user u ON u.id = legacy.user_id AND NOT u.is_deleted
JOIN sys_role r ON r.id = legacy.role_id AND r.tenant_id = u.tenant_id AND NOT r.is_deleted
LEFT JOIN sys_group g ON g.id = u.group_id AND g.tenant_id = u.tenant_id
    AND NOT g.is_deleted AND g.group_type = 'business'
WHERE r.scope IN ('platform', 'tenant') OR (r.scope = 'group' AND g.id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- Existing resource records receive an owner and a deterministic permission mode before
-- the application begins enforcing the single model. Invalid legacy creator/group values
-- fall back to an active tenant user/business group rather than crossing tenant boundaries.
DO $$
DECLARE
    resource_table TEXT;
BEGIN
    FOREACH resource_table IN ARRAY ARRAY['wiki_space', 'wiki_page', 'shared_folder', 'shared_file']
    LOOP
        EXECUTE format($sql$
            UPDATE %1$I resource
            SET owner_user_id = COALESCE(resource.owner_user_id,
                    (SELECT u.id FROM sys_user u
                     WHERE u.id = resource.created_by AND u.tenant_id = resource.tenant_id
                       AND NOT u.is_deleted),
                    (SELECT u.id FROM sys_user u
                     WHERE u.tenant_id = resource.tenant_id AND NOT u.is_deleted ORDER BY u.id LIMIT 1)),
                owner_group_id = COALESCE(resource.owner_group_id,
                    (SELECT g.id FROM sys_user u JOIN sys_group g ON g.id = u.group_id
                     WHERE u.id = resource.created_by AND u.tenant_id = resource.tenant_id
                       AND NOT u.is_deleted AND g.tenant_id = resource.tenant_id
                       AND NOT g.is_deleted AND g.group_type = 'business'),
                    (SELECT g.id FROM sys_group g
                     WHERE g.tenant_id = resource.tenant_id AND NOT g.is_deleted
                       AND g.group_type = 'business' ORDER BY g.id LIMIT 1)),
                permission_mode = COALESCE(resource.permission_mode,
                    CASE WHEN %2$L IN ('wiki_space', 'shared_folder') THEN 1528 ELSE 432 END)
            WHERE NOT resource.is_deleted
              AND (resource.owner_user_id IS NULL OR resource.owner_group_id IS NULL OR resource.permission_mode IS NULL)
        $sql$, resource_table, resource_table);
    END LOOP;
END;
$$;

-- Convert old JSON permission vocabularies to rwx bitsets. The legacy ACL tables are
-- intentionally read once here; runtime code no longer depends on them.
INSERT INTO resource_acl_entry
    (tenant_id, resource_type, resource_id, entry_type, subject_type, subject_id,
     permissions, created_by, created_at, updated_at)
SELECT tenant_id, resource_type, resource_id, 'access', subject_type, subject_id,
       (CASE WHEN permissions ? 'read' THEN 4 ELSE 0 END)
       | (CASE WHEN permissions ?| ARRAY['write', 'create', 'update', 'delete', 'publish'] THEN 2 ELSE 0 END)
       | (CASE WHEN resource_type IN ('wiki_space', 'shared_folder')
                    AND permissions ?| ARRAY['read', 'write', 'create', 'update', 'delete', 'publish']
               THEN 1 ELSE 0 END),
       created_by, created_at, updated_at
FROM (
    SELECT tenant_id, 'wiki_space'::VARCHAR AS resource_type, space_id AS resource_id,
           subject_type, subject_id, permissions, created_by, created_at, updated_at
    FROM wiki_space_acl WHERE NOT is_deleted
    UNION ALL
    SELECT tenant_id, 'wiki_page', page_id, subject_type, subject_id, permissions, created_by, created_at, updated_at
    FROM wiki_page_acl WHERE NOT is_deleted
    UNION ALL
    SELECT tenant_id, 'shared_folder', folder_id, subject_type, subject_id, permissions, created_by, created_at, updated_at
    FROM shared_folder_acl WHERE NOT is_deleted
) legacy_acl
WHERE EXISTS (
    SELECT 1 FROM sys_user u WHERE legacy_acl.subject_type = 'user'
      AND u.id = legacy_acl.subject_id AND u.tenant_id = legacy_acl.tenant_id AND NOT u.is_deleted
    UNION ALL
    SELECT 1 FROM sys_group g WHERE legacy_acl.subject_type = 'group'
      AND g.id = legacy_acl.subject_id AND g.tenant_id = legacy_acl.tenant_id
      AND NOT g.is_deleted AND g.group_type = 'business'
    UNION ALL
    SELECT 1 FROM sys_role r WHERE legacy_acl.subject_type = 'role'
      AND r.id = legacy_acl.subject_id AND r.tenant_id = legacy_acl.tenant_id AND NOT r.is_deleted
)
ON CONFLICT (tenant_id, resource_type, resource_id, entry_type, subject_type, subject_id)
    WHERE NOT is_deleted
DO UPDATE SET permissions = resource_acl_entry.permissions | EXCLUDED.permissions,
              updated_at = NOW();

DROP TRIGGER IF EXISTS trg_wiki_page_acl_active_group ON wiki_page_acl;
DROP TRIGGER IF EXISTS trg_wiki_space_acl_active_group ON wiki_space_acl;
DROP TRIGGER IF EXISTS trg_shared_folder_acl_active_group ON shared_folder_acl;

DROP TABLE IF EXISTS shared_folder_acl;
DROP TABLE IF EXISTS wiki_page_acl;
DROP TABLE IF EXISTS wiki_space_acl;
DROP TABLE IF EXISTS sys_user_role;
DROP TABLE IF EXISTS authorization_decision_diff;
DROP TABLE IF EXISTS authorization_account_rollout;
DROP TABLE IF EXISTS authorization_migration_lineage;
DROP TABLE IF EXISTS authorization_migration_exception;
DROP TABLE IF EXISTS authorization_migration_run;
DROP TABLE IF EXISTS authorization_tenant_cutover;
