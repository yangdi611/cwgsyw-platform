-- V1: 基础表（组织、用户、审计日志）

CREATE TABLE sys_group (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    name        VARCHAR(64) NOT NULL,
    description VARCHAR(255),
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMPTZ,
    deleted_by  BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  BIGINT,
    updated_by  BIGINT
);
CREATE INDEX idx_sys_group_tenant ON sys_group(tenant_id) WHERE NOT is_deleted;

CREATE TABLE sys_user (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64) NOT NULL DEFAULT 'default',
    group_id     BIGINT REFERENCES sys_group(id),
    username     VARCHAR(64) NOT NULL,
    password     VARCHAR(128) NOT NULL,
    real_name    VARCHAR(64),
    email        VARCHAR(128),
    phone        VARCHAR(32),
    avatar_url   VARCHAR(512),
    status       SMALLINT NOT NULL DEFAULT 1,
    is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at   TIMESTAMPTZ,
    deleted_by   BIGINT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   BIGINT,
    updated_by   BIGINT
);
CREATE UNIQUE INDEX idx_sys_user_username ON sys_user(tenant_id, username) WHERE NOT is_deleted;
CREATE INDEX idx_sys_user_tenant ON sys_user(tenant_id) WHERE NOT is_deleted;
CREATE INDEX idx_sys_user_group ON sys_user(group_id) WHERE NOT is_deleted;

CREATE TABLE audit_log (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64) NOT NULL DEFAULT 'default',
    module       VARCHAR(64) NOT NULL,
    action       VARCHAR(64) NOT NULL,
    target_id    BIGINT,
    target_type  VARCHAR(64),
    operator_id  BIGINT NOT NULL,
    operator_ip  VARCHAR(64),
    before_json  JSONB,
    after_json   JSONB,
    remark       VARCHAR(512),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_log_tenant_module ON audit_log(tenant_id, module, created_at DESC);
CREATE INDEX idx_audit_log_operator ON audit_log(operator_id, created_at DESC);
