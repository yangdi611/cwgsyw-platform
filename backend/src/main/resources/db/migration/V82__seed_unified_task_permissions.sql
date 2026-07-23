-- V82: add unified task, approval, work-item and calendar-settings permissions.
-- Existing resources, permissions, roles and role assignments are preserved.

INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
('task_template', '任务模板', '["create","read","update","delete","publish"]'::jsonb, 100),
('task_plan', '任务计划', '["create","read","update","delete","activate"]'::jsonb, 101),
('task', '任务实例', '["create","read","update","delete","submit","cancel","reassign"]'::jsonb, 102),
('task_analytics', '任务统计', '["read","create","update","delete","export"]'::jsonb, 103),
('approval', '审批方案', '["create","read","update","delete","publish"]'::jsonb, 104),
('work_item', '工作台', '["read","approve"]'::jsonb, 105),
('calendar_settings', '日历设置', '["read","manage"]'::jsonb, 106)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    actions = EXCLUDED.actions,
    sort_order = EXCLUDED.sort_order;

UPDATE sys_resource
SET actions = CASE
    WHEN actions::jsonb ? 'approve' THEN actions
    ELSE actions::jsonb || '["approve"]'::jsonb
END
WHERE code = 'workflow';

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT resource.id, action.value, resource.code || ':' || action.value,
       resource.name || '-' || action.value
FROM sys_resource resource
CROSS JOIN LATERAL jsonb_array_elements_text(resource.actions::jsonb) action(value)
WHERE resource.code IN (
    'task_template', 'task_plan', 'task', 'task_analytics',
    'approval', 'work_item', 'calendar_settings', 'workflow'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
CROSS JOIN sys_permission permission
WHERE role.code IN ('super_admin', 'admin')
  AND permission.code ~ '^(task_template|task_plan|task|task_analytics|approval|work_item|calendar_settings|workflow:approve)'
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission ON permission.code IN (
    'task_template:read',
    'task_plan:create', 'task_plan:read',
    'task:read', 'task:update', 'task:submit', 'task:reassign',
    'task_analytics:read', 'task_analytics:create', 'task_analytics:export',
    'approval:read',
    'work_item:read', 'work_item:approve',
    'workflow:approve',
    'calendar_settings:read'
)
WHERE role.code = 'group_leader'
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission ON permission.code IN (
    'task_template:read', 'task_plan:read',
    'task:read', 'task:update', 'task:submit',
    'task_analytics:read',
    'approval:read',
    'work_item:read',
    'calendar_settings:read'
)
WHERE role.code = 'member'
ON CONFLICT DO NOTHING;
