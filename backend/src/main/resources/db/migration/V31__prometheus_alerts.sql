-- Prometheus alert integration: cmdb_alert table + RBAC

CREATE TABLE cmdb_alert (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    ci_instance_id BIGINT REFERENCES ci_instance(id),
    alert_name VARCHAR(256) NOT NULL,
    severity VARCHAR(32) NOT NULL DEFAULT 'warning',
    status VARCHAR(32) NOT NULL DEFAULT 'firing',
    fingerprint VARCHAR(64) NOT NULL,
    summary TEXT,
    description TEXT,
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,
    raw_labels TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    acknowledged_by BIGINT,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_by BIGINT
);

CREATE UNIQUE INDEX idx_cmdb_alert_fingerprint ON cmdb_alert(fingerprint) WHERE is_deleted = FALSE;
CREATE INDEX idx_cmdb_alert_ci ON cmdb_alert(ci_instance_id, tenant_id);
CREATE INDEX idx_cmdb_alert_status ON cmdb_alert(status, tenant_id);

-- RBAC: Register cmdb_alert resource
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
    ('cmdb_alert', 'CMDB 告警', '["create","read","acknowledge"]', 54);
INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'cmdb_alert';

-- super_admin & admin: all actions
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin') AND p.code LIKE 'cmdb_alert%'
ON CONFLICT DO NOTHING;

-- group_leader: read + acknowledge (alerts are synced automatically, no manual create)
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'group_leader' AND p.code IN ('cmdb_alert:read', 'cmdb_alert:acknowledge')
ON CONFLICT DO NOTHING;

-- member: read only
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'member' AND p.code = 'cmdb_alert:read'
ON CONFLICT DO NOTHING;

-- viewer: read only
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'viewer' AND p.code = 'cmdb_alert:read'
ON CONFLICT DO NOTHING;
