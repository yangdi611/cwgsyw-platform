-- V19: 流程引擎管理权限

-- 资源已存在 (workflow:read, workflow:configure from V4)，但补充 description
UPDATE sys_resource SET description = '流程引擎 — 流程定义和审批管理'
WHERE code = 'workflow';

-- 确保 workflow:configure 权限存在
INSERT INTO sys_permission (tenant_id, resource_id, action, description, created_at, updated_at)
SELECT 'default', r.id, 'configure', '流程定义管理（CRUD 部署）', NOW(), NOW()
FROM sys_resource r
WHERE r.code = 'workflow'
  AND NOT EXISTS (
    SELECT 1 FROM sys_permission p
    WHERE p.resource_id = r.id AND p.action = 'configure'
  );

-- 赋权: super_admin, admin 拥有 workflow:configure
INSERT INTO sys_role_permission (tenant_id, role_id, permission_id, created_at, updated_at)
SELECT 'default', sr.id, sp.id, NOW(), NOW()
FROM sys_role sr
CROSS JOIN sys_permission sp
JOIN sys_resource r ON sp.resource_id = r.id
WHERE sr.code IN ('super_admin', 'admin')
  AND r.code = 'workflow' AND sp.action = 'configure'
  AND NOT EXISTS (
    SELECT 1 FROM sys_role_permission rp
    WHERE rp.role_id = sr.id AND rp.permission_id = sp.id
  );
