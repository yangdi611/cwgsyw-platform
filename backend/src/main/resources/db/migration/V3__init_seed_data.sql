-- V3: 初始种子数据

-- 初始组织
INSERT INTO sys_group (name, description) VALUES
('管理组',   '平台管理人员'),
('数据库组', '数据库运维团队'),
('主机组',   '主机运维团队'),
('网络组',   '网络运维团队'),
('云平台组', '云平台运维团队');

-- 初始资源（Phase 1 基础资源）
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
('user',     '用户管理',     '["create","read","update","delete"]', 10),
('group',    '组织管理',     '["create","read","update","delete"]', 20),
('role',     '角色管理',     '["create","read","update","delete","assign"]', 30),
('resource', '资源权限配置', '["read","assign"]', 40),
('audit',    '审计日志',     '["read"]', 50);

-- 自动生成权限记录
INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id,
       a.action,
       r.code || ':' || a.action,
       r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action);

-- 初始角色
INSERT INTO sys_role (name, code, scope, description) VALUES
('超级管理员', 'super_admin',  'platform', '平台全权限'),
('管理员',     'admin',        'tenant',   '租户内全权限'),
('运维组长',   'group_leader', 'group',    '审批本组单据'),
('运维组员',   'member',       'group',    '填报日报/变更'),
('文档管理员', 'doc_admin',    'tenant',   '管理共享文档');

-- 超级管理员拥有全部权限
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'super_admin';

-- 管理员拥有全部权限（租户级）
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'admin';

-- 初始超级管理员账号（密码: Admin@123，BCrypt 12轮加密）
INSERT INTO sys_user (username, password, real_name, email, status) VALUES
('superadmin',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewLFRWBFIlMDxSji',
 '超级管理员', 'superadmin@example.com', 1);

-- 给超级管理员分配角色
INSERT INTO sys_user_role (user_id, role_id)
SELECT u.id, r.id
FROM sys_user u, sys_role r
WHERE u.username = 'superadmin' AND r.code = 'super_admin';
