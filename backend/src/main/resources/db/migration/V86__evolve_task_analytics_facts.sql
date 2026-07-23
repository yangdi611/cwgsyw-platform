-- V86: complete the queryable task fact contract used by task analytics.
-- This migration only evolves the new unified-task domain.

ALTER TABLE task_field_fact
    ADD COLUMN field_id BIGINT REFERENCES task_template_field(id),
    ADD COLUMN sub_field_key VARCHAR(100),
    ADD COLUMN row_key VARCHAR(100),
    ADD COLUMN value_datetime TIMESTAMP,
    ADD COLUMN reference_type VARCHAR(50),
    ADD COLUMN reference_key VARCHAR(255),
    ADD COLUMN reference_label VARCHAR(500),
    ADD COLUMN business_date DATE,
    ADD COLUMN owner_user_id BIGINT,
    ADD COLUMN owner_user_name VARCHAR(255),
    ADD COLUMN owner_group_id BIGINT,
    ADD COLUMN owner_group_name VARCHAR(255),
    ADD COLUMN attachment_id BIGINT REFERENCES task_submission_attachment(id);

UPDATE task_field_fact fact
SET field_id = field.id
FROM task_template_field field
WHERE field.template_version_id = fact.template_version_id
  AND field.field_key = fact.field_key
  AND field.tenant_id = fact.tenant_id;

UPDATE task_field_fact fact
SET business_date = task.business_date,
    owner_user_id = task.assignee_id,
    owner_user_name = COALESCE(
        task.organization_snapshot ->> 'realName',
        task.organization_snapshot ->> 'username'
    ),
    owner_group_id = task.group_id,
    owner_group_name = task.organization_snapshot ->> 'groupName'
FROM task_instance task
WHERE task.id = fact.task_id
  AND task.tenant_id = fact.tenant_id;

CREATE INDEX idx_task_field_fact_time
  ON task_field_fact(tenant_id, template_version_id, business_date, is_active);

CREATE INDEX idx_task_field_fact_owner_group
  ON task_field_fact(tenant_id, owner_group_id, business_date)
  WHERE is_active;

CREATE INDEX idx_task_field_fact_reference
  ON task_field_fact(tenant_id, reference_type, reference_key, business_date)
  WHERE is_active AND reference_key IS NOT NULL;

CREATE INDEX idx_task_field_fact_lineage
  ON task_field_fact(submission_id, field_key, sub_field_key, row_key);

CREATE INDEX idx_task_field_fact_text_search
  ON task_field_fact USING GIN (to_tsvector('simple', COALESCE(value_text, '')))
  WHERE value_text IS NOT NULL AND is_active;

-- The task field registry uses single_select; the original built-in seed used a
-- workflow-template type name by mistake.
UPDATE task_template_field field
SET field_type = 'single_select'
FROM task_template_version version
JOIN task_template template ON template.id = version.template_id
WHERE field.template_version_id = version.id
  AND template.tenant_id = field.tenant_id
  AND template.code = 'basic_inspection'
  AND field.field_key = 'inspection_result'
  AND field.field_type = 'select';

UPDATE sys_resource
SET actions = CASE
    WHEN actions::jsonb ? 'share' THEN actions
    ELSE actions::jsonb || '["share"]'::jsonb
END
WHERE code = 'task_analytics';

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT resource.id, 'share', 'task_analytics:share', '任务统计-共享'
FROM sys_resource resource
WHERE resource.code = 'task_analytics'
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission ON permission.code IN (
    'task_analytics:update', 'task_analytics:delete', 'task_analytics:share'
)
WHERE role.code IN ('super_admin', 'admin', 'group_leader')
ON CONFLICT DO NOTHING;
