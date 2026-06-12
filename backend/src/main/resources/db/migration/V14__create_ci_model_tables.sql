-- V14: CI 模型分组 + 模型定义

CREATE TABLE IF NOT EXISTS ci_model_group (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    code        VARCHAR(64) NOT NULL,
    name        VARCHAR(128) NOT NULL,
    sort_order  INT DEFAULT 0,
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    deleted_by  BIGINT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by  BIGINT,
    updated_by  BIGINT
);
CREATE INDEX IF NOT EXISTS idx_ci_model_group_tenant ON ci_model_group(tenant_id) WHERE NOT is_deleted;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ci_model_group_code ON ci_model_group(tenant_id, code) WHERE NOT is_deleted;

CREATE TABLE IF NOT EXISTS ci_model (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    name            VARCHAR(64) NOT NULL,
    display_name    VARCHAR(128) NOT NULL,
    group_id        BIGINT REFERENCES ci_model_group(id),
    is_built_in     BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    updated_by      BIGINT
);
CREATE INDEX IF NOT EXISTS idx_ci_model_tenant ON ci_model(tenant_id) WHERE NOT is_deleted;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ci_model_name ON ci_model(tenant_id, name) WHERE NOT is_deleted;
