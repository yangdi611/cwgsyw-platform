-- Metric goals are current configuration records. They have no deleted-goal
-- query, restore flow, or field-level audit view; platform audit remains the
-- operation history. Delete configuration rows physically with their API.
ALTER TABLE task_metric_goal
    DROP COLUMN is_deleted,
    DROP COLUMN deleted_at,
    DROP COLUMN deleted_by,
    DROP COLUMN created_by,
    DROP COLUMN updated_by,
    DROP COLUMN created_at,
    DROP COLUMN updated_at;

CREATE INDEX idx_task_metric_goal_tenant_effective
    ON task_metric_goal(tenant_id, effective_from DESC, id DESC);
