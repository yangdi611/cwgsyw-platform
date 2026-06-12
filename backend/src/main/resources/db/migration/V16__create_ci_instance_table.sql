-- V16: CI 实例表

CREATE TABLE IF NOT EXISTS ci_instance (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    model_id    VARCHAR(64) NOT NULL,
    name        VARCHAR(256) NOT NULL,
    status      VARCHAR(32) NOT NULL DEFAULT 'online',
    owner       VARCHAR(128),
    description TEXT,
    fields_data JSONB,
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    deleted_by  BIGINT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by  BIGINT,
    updated_by  BIGINT
);
CREATE INDEX IF NOT EXISTS idx_ci_instance_tenant_model ON ci_instance(tenant_id, model_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_ci_instance_name ON ci_instance(tenant_id, model_id, name) WHERE NOT is_deleted;
