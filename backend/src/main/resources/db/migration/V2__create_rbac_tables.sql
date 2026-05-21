-- V2: RBAC 表（资源、权限、角色、关联表）

CREATE TABLE sys_resource (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(64) NOT NULL UNIQUE,
    name        VARCHAR(128) NOT NULL,
    actions     JSONB NOT NULL DEFAULT '[]',
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sys_permission (
    id           BIGSERIAL PRIMARY KEY,
    resource_id  BIGINT NOT NULL REFERENCES sys_resource(id),
    action       VARCHAR(64) NOT NULL,
    code         VARCHAR(128) NOT NULL UNIQUE,
    name         VARCHAR(128) NOT NULL,
    UNIQUE(resource_id, action)
);

CREATE TABLE sys_role (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    name        VARCHAR(64) NOT NULL,
    code        VARCHAR(64) NOT NULL,
    scope       VARCHAR(32) NOT NULL DEFAULT 'group',
    description VARCHAR(255),
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_sys_role_code ON sys_role(tenant_id, code) WHERE NOT is_deleted;

CREATE TABLE sys_role_permission (
    role_id       BIGINT NOT NULL REFERENCES sys_role(id),
    permission_id BIGINT NOT NULL REFERENCES sys_permission(id),
    PRIMARY KEY(role_id, permission_id)
);

CREATE TABLE sys_user_role (
    user_id   BIGINT NOT NULL REFERENCES sys_user(id),
    role_id   BIGINT NOT NULL REFERENCES sys_role(id),
    PRIMARY KEY(user_id, role_id)
);
