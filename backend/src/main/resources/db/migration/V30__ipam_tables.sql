-- IPAM: IP address pool management
CREATE TABLE ip_pool (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    name VARCHAR(128) NOT NULL,
    description TEXT,
    cidr VARCHAR(43) NOT NULL,
    gateway VARCHAR(39),
    dns VARCHAR(255),
    status VARCHAR(32) DEFAULT 'active',
    total_count INT NOT NULL DEFAULT 0,
    allocated_count INT NOT NULL DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_by BIGINT
);

CREATE TABLE ip_allocation (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    pool_id BIGINT NOT NULL REFERENCES ip_pool(id),
    ip_address VARCHAR(39) NOT NULL,
    status VARCHAR(32) DEFAULT 'allocated',
    ci_instance_id BIGINT REFERENCES ci_instance(id),
    description TEXT,
    allocated_by BIGINT,
    allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_by BIGINT
);

CREATE INDEX idx_ip_pool_tenant ON ip_pool(tenant_id);
CREATE INDEX idx_ip_pool_status ON ip_pool(status);
CREATE INDEX idx_ip_allocation_pool ON ip_allocation(pool_id);
CREATE INDEX idx_ip_allocation_ip ON ip_allocation(ip_address);
CREATE INDEX idx_ip_allocation_ci ON ip_allocation(ci_instance_id);
CREATE UNIQUE INDEX idx_ip_allocation_unique ON ip_allocation(pool_id, ip_address) WHERE is_deleted = FALSE;

-- RBAC: Register ip_pool resource
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
    ('ip_pool', 'IP 地址池', '["create","read","update","delete"]', 53);
INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'ip_pool';

-- Assign to super_admin and admin
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin') AND p.code LIKE 'ip_pool%'
ON CONFLICT DO NOTHING;

-- group_leader: all actions
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'group_leader' AND p.code LIKE 'ip_pool%'
ON CONFLICT DO NOTHING;

-- member: read only
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'member' AND p.code = 'ip_pool:read'
ON CONFLICT DO NOTHING;

-- viewer: read only
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'viewer' AND p.code = 'ip_pool:read'
ON CONFLICT DO NOTHING;
