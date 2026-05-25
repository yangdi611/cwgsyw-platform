-- V15: CMDB CI 实例表

CREATE TABLE ci_instance (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    model_id    VARCHAR(64)  NOT NULL,
    name        VARCHAR(255),
    attrs       JSONB        NOT NULL DEFAULT '{}',
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    deleted_by  BIGINT,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by  BIGINT       NOT NULL DEFAULT 0
);

CREATE INDEX idx_ci_instance_model ON ci_instance(tenant_id, model_id, created_at DESC) WHERE NOT is_deleted;
CREATE INDEX idx_ci_instance_attrs ON ci_instance USING GIN(attrs);
