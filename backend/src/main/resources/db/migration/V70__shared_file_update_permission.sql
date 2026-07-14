-- Add the functional permission required by the unified resource model for
-- future shared-file rename and move operations. Existing manage roles retain
-- their effective capability; account, assignment, ACL, and rollout data are untouched.
UPDATE sys_resource
SET actions = actions || '["update"]'::jsonb
WHERE code = 'shared_file'
  AND NOT (actions @> '["update"]'::jsonb);

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT id, 'update', 'shared_file:update', '共享文档-编辑'
FROM sys_resource
WHERE code = 'shared_file'
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT DISTINCT role_permission.role_id, update_permission.id
FROM sys_role_permission role_permission
JOIN sys_permission manage_permission
  ON manage_permission.id = role_permission.permission_id
 AND manage_permission.code = 'shared_file:manage'
JOIN sys_permission update_permission
  ON update_permission.code = 'shared_file:update'
ON CONFLICT DO NOTHING;
