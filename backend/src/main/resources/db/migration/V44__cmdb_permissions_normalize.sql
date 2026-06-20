-- V44: CMDB 权限资源/action 收敛 (AC7 / AD-7)
--
-- 目标: 对齐 canonical 权限矩阵 (见 docs/specs/2026-06-19-cmdb-architecture-debt-spec-glm52.md § AD-7)
--
-- 背景问题:
--   - write 残留: V14 创建 cmdb_model 带 write，V40 保留 write + update 共存
--   - cmdb_attribute / cmdb_topology 从未作为独立资源存在
--   - cmdb_import / cmdb_impact 当前挂在 cmdb_instance action 上 (V25/V26)，AD-7 提升为独立资源
--   - cmdb_relation actions 缺 update (V23 漏，V24 仅补了 permission)
--
-- 全部语句幂等 (ON CONFLICT DO NOTHING / NOT EXISTS guard)。

-- =====================================================================
-- 1. 新增独立资源定义
-- =====================================================================

-- 1a. cmdb_attribute (read, create, update, delete)
INSERT INTO sys_resource (code, name, actions, sort_order)
VALUES ('cmdb_attribute', 'CMDB 属性管理', '["read","create","update","delete"]', 55)
ON CONFLICT (code) DO NOTHING;

-- 1b. cmdb_topology (read)
INSERT INTO sys_resource (code, name, actions, sort_order)
VALUES ('cmdb_topology', 'CMDB 拓扑', '["read"]', 56)
ON CONFLICT (code) DO NOTHING;

-- 1c. cmdb_import (read, execute)
INSERT INTO sys_resource (code, name, actions, sort_order)
VALUES ('cmdb_import', 'CMDB 导入', '["read","execute"]', 57)
ON CONFLICT (code) DO NOTHING;

-- 1d. cmdb_impact (read)
INSERT INTO sys_resource (code, name, actions, sort_order)
VALUES ('cmdb_impact', 'CMDB 影响分析', '["read"]', 58)
ON CONFLICT (code) DO NOTHING;

-- =====================================================================
-- 2. cmdb_model 增加 manage action (AD-7 矩阵)
-- =====================================================================
UPDATE sys_resource
SET actions = actions || '["manage"]'::jsonb
WHERE code = 'cmdb_model'
  AND NOT actions ? 'manage';

-- =====================================================================
-- 3. cmdb_relation 补全 update action (V23 缺，V24 仅补 permission)
-- =====================================================================
UPDATE sys_resource
SET actions = actions || '["update"]'::jsonb
WHERE code = 'cmdb_relation'
  AND NOT actions ? 'update';

-- =====================================================================
-- 4. 自动生成 canonical 权限记录
--    覆盖新资源全部 action，以及补齐 cmdb_model:manage/update、cmdb_relation:update
-- =====================================================================
INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code IN ('cmdb_attribute', 'cmdb_topology', 'cmdb_import', 'cmdb_impact',
                 'cmdb_model', 'cmdb_relation')
  AND NOT EXISTS (
    SELECT 1 FROM sys_permission p
    WHERE p.resource_id = r.id AND p.action = a.action
  )
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 5. 别名映射: cmdb_model:write → cmdb_model:update
--    所有拥有 cmdb_model:write 的角色同时授予 cmdb_model:update，
--    使旧 write 用户在 controller 迁移到 update 后不失权。
-- =====================================================================
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT rp.role_id, upd.id
FROM sys_role_permission rp
JOIN sys_permission wp ON rp.permission_id = wp.id AND wp.code = 'cmdb_model:write'
JOIN sys_permission upd ON upd.code = 'cmdb_model:update'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 6. 角色权限分配 — 新资源 + cmdb_model:manage
-- =====================================================================

-- 6a. super_admin + admin: 所有新资源全部 action + cmdb_model:manage
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin')
  AND p.code IN (
      'cmdb_attribute:read', 'cmdb_attribute:create', 'cmdb_attribute:update', 'cmdb_attribute:delete',
      'cmdb_topology:read',
      'cmdb_import:read', 'cmdb_import:execute',
      'cmdb_impact:read',
      'cmdb_model:manage')
ON CONFLICT DO NOTHING;

-- 6b. group_leader: cmdb_attribute:read, cmdb_topology:read, cmdb_import:read/execute, cmdb_impact:read
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'group_leader'
  AND p.code IN (
      'cmdb_attribute:read', 'cmdb_topology:read',
      'cmdb_import:read', 'cmdb_import:execute',
      'cmdb_impact:read')
ON CONFLICT DO NOTHING;

-- 6c. member: cmdb_attribute:read, cmdb_topology:read, cmdb_impact:read
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'member'
  AND p.code IN (
      'cmdb_attribute:read', 'cmdb_topology:read', 'cmdb_impact:read')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 7. 确保 cmdb_relation:update 授权完整 (V24 已授予 super_admin/admin/group_leader，幂等补全)
-- =====================================================================
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin', 'group_leader')
  AND p.code = 'cmdb_relation:update'
ON CONFLICT DO NOTHING;
