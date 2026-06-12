-- V15: CI 属性分组 + 属性定义

CREATE TABLE IF NOT EXISTS ci_attribute_group (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    model_id    VARCHAR(64) NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_ci_attr_group_model ON ci_attribute_group(tenant_id, model_id) WHERE NOT is_deleted;

CREATE TABLE IF NOT EXISTS ci_attribute (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    model_id        VARCHAR(64) NOT NULL,
    field_key       VARCHAR(64) NOT NULL,
    name            VARCHAR(128) NOT NULL,
    group_id        VARCHAR(64),
    field_type      VARCHAR(32) NOT NULL,
    is_required     BOOLEAN NOT NULL DEFAULT FALSE,
    is_editable     BOOLEAN NOT NULL DEFAULT TRUE,
    is_unique       BOOLEAN NOT NULL DEFAULT FALSE,
    is_built_in     BOOLEAN NOT NULL DEFAULT FALSE,
    is_list_show    BOOLEAN NOT NULL DEFAULT FALSE,
    default_value   VARCHAR(512),
    enum_options    TEXT,
    sort_order      INT DEFAULT 0,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    updated_by      BIGINT
);
CREATE INDEX IF NOT EXISTS idx_ci_attribute_model ON ci_attribute(tenant_id, model_id) WHERE NOT is_deleted;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ci_attribute_key ON ci_attribute(tenant_id, model_id, field_key) WHERE NOT is_deleted;
