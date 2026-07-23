-- Archived subscriptions remain the parent of immutable delivery history.
-- Their soft-delete state duplicates the explicit status lifecycle, while
-- creator/updater identity has no read, UI, authorization, or audit consumer.

ALTER TABLE task_analytics_subscription
    DROP COLUMN created_by,
    DROP COLUMN updated_by,
    DROP COLUMN is_deleted,
    DROP COLUMN deleted_at,
    DROP COLUMN deleted_by;

DROP INDEX IF EXISTS idx_task_analytics_subscription_dashboard;
DROP INDEX IF EXISTS idx_task_analytics_subscription_due;

CREATE INDEX idx_task_analytics_subscription_dashboard
    ON task_analytics_subscription(dashboard_id, updated_at DESC)
    WHERE status <> 'archived';

CREATE INDEX idx_task_analytics_subscription_due
    ON task_analytics_subscription(tenant_id, next_send_at)
    WHERE status = 'active';
