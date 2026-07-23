-- Notification center supports read-state changes but exposes no delete,
-- restore, edit, or audit-field view. Remove already logically deleted rows
-- before dropping the redundant soft-delete/audit columns.

DELETE FROM notification_message
WHERE is_deleted = TRUE;

ALTER TABLE notification_message
    DROP COLUMN is_deleted,
    DROP COLUMN deleted_at,
    DROP COLUMN deleted_by,
    DROP COLUMN updated_at,
    DROP COLUMN created_by,
    DROP COLUMN updated_by;

DROP INDEX IF EXISTS idx_notification_user;
DROP INDEX IF EXISTS idx_notification_tenant;

CREATE INDEX idx_notification_user_timeline
    ON notification_message(user_id, created_at DESC);

CREATE INDEX idx_notification_user_unread
    ON notification_message(user_id)
    WHERE is_read = FALSE;

CREATE INDEX idx_notification_reference
    ON notification_message(tenant_id, ref_type, ref_id)
    WHERE ref_type IS NOT NULL AND ref_id IS NOT NULL;
