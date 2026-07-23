-- An archived automation rule remains as the immutable parent of execution
-- history. A second soft-delete state and an unused optimistic-lock column
-- only create divergent lifecycle semantics and have no terminal consumer.

ALTER TABLE task_automation_rule
    DROP COLUMN lock_version,
    DROP COLUMN created_by,
    DROP COLUMN is_deleted,
    DROP COLUMN deleted_at,
    DROP COLUMN deleted_by;

DROP INDEX IF EXISTS idx_task_automation_rule_enabled;
CREATE INDEX idx_task_automation_rule_active
    ON task_automation_rule(tenant_id, trigger_type)
    WHERE status = 'active';
