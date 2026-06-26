-- Folder-level ACL with override inheritance
ALTER TABLE shared_folder ADD COLUMN IF NOT EXISTS acl_inherited BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS shared_folder_acl (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64) NOT NULL DEFAULT 'default',
    folder_id    BIGINT      NOT NULL,
    subject_type VARCHAR(16) NOT NULL,  -- 'role' | 'group' | 'user'
    subject_id   BIGINT      NOT NULL,
    permissions  JSONB       NOT NULL DEFAULT '[]',  -- ["read","write","update","delete"]
    created_by   BIGINT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at   TIMESTAMP,
    deleted_by   BIGINT
);

CREATE INDEX IF NOT EXISTS idx_sfa_folder ON shared_folder_acl(folder_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_sfa_tenant  ON shared_folder_acl(tenant_id) WHERE NOT is_deleted;

-- Add manage_acl to shared_file resource actions (guard against re-run duplicate)
UPDATE sys_resource
SET actions = actions || '["manage_acl"]'::jsonb
WHERE code = 'shared_file'
  AND NOT (actions @> '["manage_acl"]'::jsonb);

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, 'manage_acl', 'shared_file:manage_acl', '共享文档-管理访问权限'
FROM sys_resource r WHERE r.code = 'shared_file'
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin') AND p.code = 'shared_file:manage_acl'
ON CONFLICT DO NOTHING;
