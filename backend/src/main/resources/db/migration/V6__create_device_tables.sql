-- V6: 设备密码库

CREATE TABLE device (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    group_id    BIGINT REFERENCES sys_group(id),
    name        VARCHAR(128) NOT NULL,
    ip          VARCHAR(64),
    device_type VARCHAR(64) NOT NULL DEFAULT 'server',
    category    VARCHAR(64),
    description TEXT,
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    deleted_by  BIGINT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by  BIGINT,
    updated_by  BIGINT
);
CREATE INDEX idx_device_group ON device(group_id) WHERE NOT is_deleted;
CREATE INDEX idx_device_tenant ON device(tenant_id) WHERE NOT is_deleted;

CREATE TABLE device_credential (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    device_id       BIGINT NOT NULL REFERENCES device(id),
    username        VARCHAR(128) NOT NULL,
    password_enc    TEXT NOT NULL,
    description     VARCHAR(255),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    updated_by      BIGINT
);
CREATE INDEX idx_device_credential_device ON device_credential(device_id) WHERE NOT is_deleted;

CREATE TABLE password_access_log (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    device_id       BIGINT NOT NULL,
    credential_id   BIGINT NOT NULL,
    operator_id     BIGINT NOT NULL,
    operator_ip     VARCHAR(64),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pw_access_device ON password_access_log(device_id, created_at DESC);
CREATE INDEX idx_pw_access_operator ON password_access_log(operator_id, created_at DESC);

INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
('device', '设备密码库', '["create","read","update","delete","view_password"]', 80);

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'device';

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin') AND p.code LIKE 'device:%'
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'group_leader'
  AND p.code IN ('device:create','device:read','device:update','device:view_password')
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'member' AND p.code = 'device:read'
ON CONFLICT DO NOTHING;
