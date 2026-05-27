-- V17: 共享文档模块

CREATE TABLE shared_folder (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    name        VARCHAR(255) NOT NULL,
    parent_id   BIGINT,
    created_by  BIGINT       NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    deleted_by  BIGINT
);

CREATE TABLE shared_file (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      VARCHAR(64)  NOT NULL DEFAULT 'default',
    folder_id      BIGINT,
    name           VARCHAR(255) NOT NULL,
    original_name  VARCHAR(255) NOT NULL,
    file_type      VARCHAR(32)  NOT NULL,
    size_bytes     BIGINT       NOT NULL,
    minio_key      VARCHAR(512) NOT NULL,
    md_key         VARCHAR(512),
    visible_groups JSONB        NOT NULL DEFAULT '[]',
    source_type    VARCHAR(32),
    source_id      BIGINT,
    created_by     BIGINT       NOT NULL DEFAULT 0,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    is_deleted     BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at     TIMESTAMP,
    deleted_by     BIGINT
);

CREATE INDEX idx_shared_file_folder ON shared_file(tenant_id, folder_id) WHERE NOT is_deleted;
CREATE INDEX idx_shared_file_name_fts ON shared_file USING GIN(to_tsvector('simple', name)) WHERE NOT is_deleted;
CREATE INDEX idx_shared_file_source ON shared_file(tenant_id, source_type, source_id) WHERE NOT is_deleted;

-- RBAC: 新增 shared_file 资源
INSERT INTO sys_resource (code, name, actions, sort_order, created_at)
VALUES ('shared_file', '共享文档', '["read","upload","delete","manage"]', 100, NOW());

-- Permissions (resource_id references sys_resource.id)
INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, 'shared_file:' || a.action, a.name
FROM sys_resource r
CROSS JOIN (
  VALUES ('read', '查看文件'), ('upload', '上传文件'), ('delete', '删除文件'), ('manage', '管理文件夹')
) AS a(action, name)
WHERE r.code = 'shared_file';

-- Role-permission assignments (role_id + permission_id)
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT sr.id, sp.id
FROM sys_permission sp
CROSS JOIN (
  SELECT id, code FROM sys_role WHERE code IN ('super_admin','admin','group_leader','member','viewer')
) sr
WHERE sp.code LIKE 'shared_file:%'
AND (
  (sr.code = 'viewer'       AND sp.action = 'read') OR
  (sr.code = 'member'       AND sp.action IN ('read','upload')) OR
  (sr.code = 'group_leader' AND sp.action IN ('read','upload','delete')) OR
  (sr.code = 'admin'        AND sp.action IN ('read','upload','delete','manage')) OR
  (sr.code = 'super_admin'  AND sp.action IN ('read','upload','delete','manage'))
);
