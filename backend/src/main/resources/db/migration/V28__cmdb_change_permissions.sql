-- V28: 变更历史查询权限

-- 新增 cmdb_change 资源
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
    ('cmdb_change', 'CMDB 变更历史', '["read"]', 53)
ON CONFLICT DO NOTHING;

-- 自动生成权限记录
INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, 'read', 'cmdb_change:read', 'CMDB 变更历史-查看'
FROM sys_resource r
WHERE r.code = 'cmdb_change'
ON CONFLICT DO NOTHING;

-- 超级管理员 + 管理员 + 组长 + 组员均可查看变更历史
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin', 'group_leader', 'member')
  AND p.code = 'cmdb_change:read'
ON CONFLICT DO NOTHING;
