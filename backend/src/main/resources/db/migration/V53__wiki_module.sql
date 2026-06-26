-- V53: Wiki 知识库模块
-- 5 张表：wiki_space / wiki_page / wiki_page_version / wiki_backlink / wiki_page_acl
-- 决策1：暂不建 FTS GIN 索引（simple 配置对中文无分词，搜索走 ILIKE）
-- 附件复用 shared_file 表（source_type='wiki_page'），故本迁移不建附件表

-- 1. Wiki 空间（顶级隔离，类 Obsidian Vault）
CREATE TABLE wiki_space (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    created_by  BIGINT,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by  BIGINT,
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    deleted_by  BIGINT
);
CREATE INDEX idx_wiki_space_tenant ON wiki_space(tenant_id) WHERE NOT is_deleted;

-- 2. Wiki 页面（树形结构，正文存 DB TEXT）
CREATE TABLE wiki_page (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           VARCHAR(64)  NOT NULL DEFAULT 'default',
    space_id            BIGINT       NOT NULL REFERENCES wiki_space(id),
    parent_id           BIGINT,                       -- null = 根页面
    slug                VARCHAR(255) NOT NULL,         -- URL 友好名，同级唯一
    title               VARCHAR(500) NOT NULL,
    content             TEXT         NOT NULL DEFAULT '',
    status              VARCHAR(32)  NOT NULL DEFAULT 'draft', -- draft|review|published|archived
    current_version     INT          NOT NULL DEFAULT 1,
    process_instance_id VARCHAR(255),
    sort_order          INT          NOT NULL DEFAULT 0,
    acl_inherited       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by          BIGINT,
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    is_deleted          BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMP,
    deleted_by          BIGINT
);
CREATE INDEX idx_wiki_page_space  ON wiki_page(space_id)  WHERE NOT is_deleted;
CREATE INDEX idx_wiki_page_parent ON wiki_page(parent_id) WHERE NOT is_deleted;

-- 3. 版本历史（每次保存一份全量快照）
CREATE TABLE wiki_page_version (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    page_id     BIGINT       NOT NULL,
    version     INT          NOT NULL,
    title       VARCHAR(500) NOT NULL,
    content     TEXT         NOT NULL,
    comment     VARCHAR(500),
    created_by  BIGINT,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_wiki_page_version_page ON wiki_page_version(page_id, version DESC);

-- 4. 反向链接（[[wiki links]] 解析结果）
CREATE TABLE wiki_backlink (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64) NOT NULL DEFAULT 'default',
    from_page_id BIGINT      NOT NULL,
    to_page_id   BIGINT      NOT NULL,
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (from_page_id, to_page_id)
);
CREATE INDEX idx_wiki_backlink_to   ON wiki_backlink(to_page_id);
CREATE INDEX idx_wiki_backlink_from ON wiki_backlink(from_page_id);

-- 5. 页面 ACL（复用 shared_folder_acl 结构）
CREATE TABLE wiki_page_acl (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64) NOT NULL DEFAULT 'default',
    page_id      BIGINT      NOT NULL,
    subject_type VARCHAR(16) NOT NULL,   -- 'role' | 'group' | 'user'
    subject_id   BIGINT      NOT NULL,
    permissions  JSONB       NOT NULL DEFAULT '[]', -- ["read","write","delete","publish"]
    created_by   BIGINT,
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted   BOOLEAN     NOT NULL DEFAULT FALSE,
    deleted_at   TIMESTAMP,
    deleted_by   BIGINT
);
CREATE INDEX idx_wiki_page_acl_page ON wiki_page_acl(page_id) WHERE NOT is_deleted;

-- ============ RBAC seed（仿 V50/V14 三段式）============
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
    ('wiki', 'Wiki 知识库', '["create","read","update","delete","publish","manage_acl"]', 95)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'wiki'
ON CONFLICT DO NOTHING;

-- super_admin / admin：全部
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin') AND p.code LIKE 'wiki:%'
ON CONFLICT DO NOTHING;

-- group_leader：create/read/update/delete
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM sys_role r, sys_permission p
WHERE r.code = 'group_leader'
  AND p.code IN ('wiki:create','wiki:read','wiki:update','wiki:delete')
ON CONFLICT DO NOTHING;

-- member：create/read/update
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM sys_role r, sys_permission p
WHERE r.code = 'member' AND p.code IN ('wiki:create','wiki:read','wiki:update')
ON CONFLICT DO NOTHING;

-- viewer：read
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM sys_role r, sys_permission p
WHERE r.code = 'viewer' AND p.code = 'wiki:read'
ON CONFLICT DO NOTHING;
