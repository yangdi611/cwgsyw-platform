-- V66: Wiki 空间级 ACL —— 用户自建空间的创建人可自行授权他人 create/update/delete/publish
-- 设计对齐 docs/plan/wiki/space_ACL/SPEC.md 第 4 章：
--   1. 无 acl_inherited 概念：本表存在的行即为在默认状态上追加的白名单（纯加法，非覆盖式继承）
--   2. permissions 不含 'read'：所有登录用户默认可读用户自建空间，本表不表达、也不允许收紧 read
--   3. 仅对用户自建空间（wiki_space.seed_key IS NULL）生效；系统空间继续走 write_scope
CREATE TABLE wiki_space_acl (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64) NOT NULL DEFAULT 'default',
    space_id     BIGINT      NOT NULL REFERENCES wiki_space(id),
    subject_type VARCHAR(16) NOT NULL,   -- 'role' | 'group' | 'user'
    subject_id   BIGINT      NOT NULL,
    permissions  JSONB       NOT NULL DEFAULT '[]', -- ["create","update","delete","publish"]，不含 read
    created_by   BIGINT,
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted   BOOLEAN     NOT NULL DEFAULT FALSE,
    deleted_at   TIMESTAMP,
    deleted_by   BIGINT
);

CREATE INDEX idx_wiki_space_acl_space ON wiki_space_acl(space_id) WHERE NOT is_deleted;
CREATE INDEX idx_wiki_space_acl_tenant ON wiki_space_acl(tenant_id) WHERE NOT is_deleted;
