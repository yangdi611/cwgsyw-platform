-- Backup/restore: PostgreSQL dump + MinIO objects archive
CREATE TABLE backup_record (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(512),
    file_size_bytes BIGINT DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'running',  -- running / success / failed
    backup_type VARCHAR(32) NOT NULL DEFAULT 'manual', -- manual / scheduled
    error_message TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_by BIGINT
);

CREATE INDEX idx_backup_record_tenant ON backup_record(tenant_id);
CREATE INDEX idx_backup_record_status ON backup_record(status);
CREATE INDEX idx_backup_record_created ON backup_record(created_at);

-- RBAC: Register backup resource (admin-only operation)
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
    ('backup', '备份与恢复', '["create","read","restore","delete"]', 90);
INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'backup';

-- Assign all backup actions to super_admin and admin only
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin') AND p.code LIKE 'backup:%'
ON CONFLICT DO NOTHING;
