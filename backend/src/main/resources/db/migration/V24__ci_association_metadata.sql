-- V24: Association metadata — ci_instance_rel.metadata JSONB + ci_association_attr_def table

-- 1. ci_instance_rel 新增 metadata JSONB
ALTER TABLE ci_instance_rel
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_ci_rel_metadata ON ci_instance_rel USING GIN(metadata);

-- 2. ci_association_attr_def 表
CREATE TABLE IF NOT EXISTS ci_association_attr_def (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL DEFAULT 'default',
    association_kind  VARCHAR(64) NOT NULL,
    field_key         VARCHAR(64) NOT NULL,
    name              VARCHAR(128) NOT NULL,
    field_type        VARCHAR(32) NOT NULL,
    is_required       BOOLEAN NOT NULL DEFAULT FALSE,
    enum_options      TEXT,
    default_value     VARCHAR(512),
    sort_order        INT NOT NULL DEFAULT 0,
    is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMP,
    deleted_by        BIGINT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by        BIGINT,
    updated_by        BIGINT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ci_assoc_attr_kind_key
ON ci_association_attr_def(tenant_id, association_kind, field_key)
WHERE NOT is_deleted;

-- 3. 关联元数据更新权限 (cmdb_relation:update action)
INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, 'update', 'cmdb_relation:update', '更新关联'
FROM sys_resource r
WHERE r.code = 'cmdb_relation'
ON CONFLICT DO NOTHING;

-- 超级管理员 + 管理员 + 组长可更新关联
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin', 'group_leader')
  AND p.code = 'cmdb_relation:update'
ON CONFLICT DO NOTHING;
