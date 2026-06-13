-- V16: CMDB CI 实例关联表

CREATE TABLE ci_instance_rel (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    def_id      VARCHAR(128) NOT NULL,
    src_id      BIGINT       NOT NULL,
    dst_id      BIGINT       NOT NULL,
    attrs       JSONB        NOT NULL DEFAULT '{}',
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    deleted_by  BIGINT,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by  BIGINT       NOT NULL DEFAULT 0,
    updated_by  BIGINT
);

CREATE INDEX idx_ci_rel_src   ON ci_instance_rel(tenant_id, src_id) WHERE NOT is_deleted;
CREATE INDEX idx_ci_rel_dst   ON ci_instance_rel(tenant_id, dst_id) WHERE NOT is_deleted;
CREATE INDEX idx_ci_rel_attrs ON ci_instance_rel USING GIN(attrs)   WHERE NOT is_deleted;
CREATE UNIQUE INDEX idx_ci_rel_unique
    ON ci_instance_rel(tenant_id, def_id, src_id, dst_id) WHERE NOT is_deleted;
