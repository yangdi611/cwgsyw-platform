-- V23: CMDB 权限 seed 数据

-- 资源
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
    ('cmdb_model',     'CMDB 模型管理', '["create","read","update","delete"]', 50),
    ('cmdb_instance',  'CMDB 实例管理', '["create","read","update","delete"]', 51),
    ('cmdb_relation',  'CMDB 关联关系', '["create","read","delete"]',          52)
ON CONFLICT DO NOTHING;

-- 自动生成权限记录
INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code IN ('cmdb_model', 'cmdb_instance', 'cmdb_relation');

-- 超级管理员 + 管理员拥有全部 CMDB 权限
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin') AND p.code LIKE 'cmdb_%'
ON CONFLICT DO NOTHING;

-- 组长：模型读 + 实例读写 + 关联读写
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'group_leader'
  AND p.code IN (
      'cmdb_model:read',
      'cmdb_instance:create', 'cmdb_instance:read', 'cmdb_instance:update',
      'cmdb_relation:create', 'cmdb_relation:read')
ON CONFLICT DO NOTHING;

-- 组员：只读
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'member'
  AND p.code IN ('cmdb_model:read', 'cmdb_instance:read', 'cmdb_relation:read')
ON CONFLICT DO NOTHING;

-- 文档管理员：只读
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'doc_admin'
  AND p.code IN ('cmdb_model:read', 'cmdb_instance:read')
ON CONFLICT DO NOTHING;
