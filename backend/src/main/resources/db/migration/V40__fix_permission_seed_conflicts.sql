-- V40: 修复 V14/V23 权限种子冲突
--
-- 问题背景:
-- V14 为 cmdb_model 设置了 actions = ["read","write"]
-- V23 试图更新为 ["create","read","update","delete"] 但 ON CONFLICT DO NOTHING 阻止了更新
-- 导致 cmdb_model:create 和 cmdb_model:delete 权限从未生成
--
-- 同时，CiInstanceController 历史查询端点需要 cmdb_change:read 权限

-- 1) 更新 cmdb_model 资源 actions，包含所有 controller 需要的 action
UPDATE sys_resource
SET actions = '["create","read","update","delete","write"]'::jsonb
WHERE code = 'cmdb_model';

-- 2) 生成缺少的 cmdb_model 权限
INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'cmdb_model'
  AND a.action NOT IN (
    SELECT action FROM sys_permission WHERE resource_id = r.id
  )
ON CONFLICT DO NOTHING;

-- 3) 为超级管理员和管理员授予新增的 cmdb_model 权限
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin')
  AND p.code IN ('cmdb_model:create', 'cmdb_model:delete')
ON CONFLICT DO NOTHING;

-- 4) 为组领导授予新增的 cmdb_model 权限
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('group_leader')
  AND p.code IN ('cmdb_model:create', 'cmdb_model:delete')
ON CONFLICT DO NOTHING;

-- 5) 添加 cmdb_change 资源（用于实例变更历史端点）
INSERT INTO sys_resource (code, name, actions, sort_order)
VALUES ('cmdb_change', 'CMDB 变更历史', '["read"]', 53)
ON CONFLICT DO NOTHING;

-- 6) 生成 cmdb_change 权限
INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'cmdb_change'
  AND NOT EXISTS (
    SELECT 1 FROM sys_permission p
    WHERE p.resource_id = r.id AND p.action = a.action
  );

-- 7) 为所有已有 CMDB 权限的角色授予 cmdb_change:read
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT rp.role_id, p.id
FROM sys_role_permission rp
JOIN sys_permission cp ON rp.permission_id = cp.id AND cp.code LIKE 'cmdb_%'
JOIN sys_permission p ON p.code = 'cmdb_change:read'
WHERE NOT EXISTS (
  SELECT 1 FROM sys_role_permission rp2
  WHERE rp2.role_id = rp.role_id AND rp2.permission_id = p.id
)
GROUP BY rp.role_id, p.id;
