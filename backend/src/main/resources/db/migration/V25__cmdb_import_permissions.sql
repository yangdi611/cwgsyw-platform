-- V25: CSV import permissions

-- 新增 cmdb_instance:import action
UPDATE sys_resource
SET actions = actions || '["import"]'::jsonb
WHERE code = 'cmdb_instance';

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, 'import', 'cmdb_instance:import', 'CSV 导入实例'
FROM sys_resource r
WHERE r.code = 'cmdb_instance'
ON CONFLICT DO NOTHING;

-- 超级管理员 + 管理员 + 组长可导入
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin', 'group_leader')
  AND p.code = 'cmdb_instance:import'
ON CONFLICT DO NOTHING;
