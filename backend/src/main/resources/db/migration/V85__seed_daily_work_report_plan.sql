-- V85: initialize the built-in workday report plan on the default tenant.
-- The plan uses the unified task scheduler and creates one task per active user per workday.

INSERT INTO task_plan (
    tenant_id,
    name,
    description,
    template_version_id,
    approval_scheme_version_id,
    schedule_type,
    schedule_config,
    generation_mode,
    assignment_rule,
    ci_scope_config,
    reminder_config,
    escalation_config,
    generate_ahead_days,
    start_date,
    status,
    next_generate_at,
    created_by,
    updated_by
)
SELECT
    'default',
    '内置工作日报计划',
    '每个工作日为所有在职用户分别生成一份工作日报任务',
    version.id,
    NULL,
    'daily',
    '{"time":"09:00","workdaysOnly":true,"dueAfterHours":15,"priority":"normal"}'::jsonb,
    'per_user',
    '{"strategy":"all_users"}'::jsonb,
    '{"selections":[]}'::jsonb,
    '{"stages":[{"type":"before_due","offsetMinutes":120}]}'::jsonb,
    '{}'::jsonb,
    7,
    CURRENT_DATE,
    'active',
    NOW(),
    0,
    0
FROM task_template template
JOIN task_template_version version ON version.id = template.latest_version_id
WHERE template.tenant_id = 'default'
  AND template.code = 'daily_work_report'
  AND template.status = 'published'
  AND version.status = 'published'
  AND NOT EXISTS (
      SELECT 1
      FROM task_plan existing
      WHERE existing.tenant_id = 'default'
        AND existing.name = '内置工作日报计划'
        AND existing.is_deleted = FALSE
  );
