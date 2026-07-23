-- Link subscription dispatch batches to the shared durable notification runtime.
-- This lets last_sent_at reflect completed delivery instead of queue admission.

ALTER TABLE task_notification_delivery
    ADD COLUMN subscription_id BIGINT REFERENCES task_analytics_subscription(id),
    ADD COLUMN batch_key VARCHAR(255);

CREATE INDEX idx_task_notification_delivery_subscription_batch
    ON task_notification_delivery(tenant_id, subscription_id, batch_key, status)
    WHERE subscription_id IS NOT NULL;
