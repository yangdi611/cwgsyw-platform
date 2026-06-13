-- V26: Impact analysis permissions

-- 新增 cmdb_instance:impact action
UPDATE sys_resource
SET actions = actions || '["impact"]'::jsonb
WHERE code = 'cmdb_instance';

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, 'impact', 'cmdb_instance:impact', '影响分析'
FROM sys_resource r
WHERE r.code = 'cmdb_instance'
ON CONFLICT DO NOTHING;

-- 所有 CMDB 读权限角色均可执行影响分析
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin', 'group_leader', 'member')
  AND p.code = 'cmdb_instance:impact'
ON CONFLICT DO NOTHING;
