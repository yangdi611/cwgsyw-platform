-- V17: CI 关联类型定义 + 关联定义 + 实例关系

CREATE TABLE IF NOT EXISTS ci_association_kind (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    code        VARCHAR(64) NOT NULL,
    name        VARCHAR(128) NOT NULL,
    is_built_in BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    deleted_by  BIGINT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by  BIGINT,
    updated_by  BIGINT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ci_assoc_kind_code ON ci_association_kind(tenant_id, code) WHERE NOT is_deleted;

CREATE TABLE IF NOT EXISTS ci_association_def (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL DEFAULT 'default',
    src_model_id      VARCHAR(64) NOT NULL,
    dst_model_id      VARCHAR(64) NOT NULL,
    association_kind  VARCHAR(64) NOT NULL,
    is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMP,
    deleted_by        BIGINT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by        BIGINT,
    updated_by        BIGINT
);
CREATE INDEX IF NOT EXISTS idx_ci_assoc_def_models ON ci_association_def(src_model_id, dst_model_id) WHERE NOT is_deleted;

CREATE TABLE IF NOT EXISTS ci_instance_rel (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL DEFAULT 'default',
    src_instance_id   BIGINT NOT NULL,
    dst_instance_id   BIGINT NOT NULL,
    association_kind  VARCHAR(64) NOT NULL,
    is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMP,
    deleted_by        BIGINT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by        BIGINT,
    updated_by        BIGINT
);
CREATE INDEX IF NOT EXISTS idx_ci_rel_src ON ci_instance_rel(src_instance_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_ci_rel_dst ON ci_instance_rel(dst_instance_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_ci_rel_kind ON ci_instance_rel(association_kind) WHERE NOT is_deleted;
