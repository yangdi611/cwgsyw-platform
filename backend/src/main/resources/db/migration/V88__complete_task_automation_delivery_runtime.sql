-- V88: make automation retries replay the original event and route all new
-- unified-task notifications through the idempotent delivery runtime.

ALTER TABLE task_automation_execution
    ADD COLUMN event_type VARCHAR(32),
    ADD COLUMN source_task_id BIGINT REFERENCES task_instance(id),
    ADD COLUMN source_submission_id BIGINT REFERENCES task_submission(id),
    ADD COLUMN source_occurred_at TIMESTAMP,
    ADD COLUMN source_attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE task_automation_execution execution
SET event_type = rule.trigger_type,
    source_task_id = CASE WHEN execution.source_type = 'task' THEN execution.source_id END,
    source_submission_id = CASE WHEN execution.source_type = 'submission' THEN execution.source_id END,
    source_occurred_at = execution.created_at
FROM task_automation_rule rule
WHERE rule.id = execution.rule_id;

UPDATE task_automation_execution execution
SET source_task_id = submission.task_id
FROM task_submission submission
WHERE execution.source_task_id IS NULL
  AND execution.source_submission_id = submission.id
  AND execution.tenant_id = submission.tenant_id;

ALTER TABLE task_automation_execution
    ALTER COLUMN event_type SET NOT NULL,
    ALTER COLUMN source_occurred_at SET NOT NULL;

CREATE INDEX idx_task_automation_execution_source_task
    ON task_automation_execution(tenant_id, source_task_id, created_at DESC)
    WHERE source_task_id IS NOT NULL;

CREATE INDEX idx_task_automation_execution_source_event
    ON task_automation_execution(tenant_id, source_task_id, event_type, created_at DESC)
    WHERE source_task_id IS NOT NULL;

ALTER TABLE notification_message
    ADD COLUMN dedupe_key VARCHAR(255);

CREATE UNIQUE INDEX uq_notification_message_dedupe
    ON notification_message(tenant_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL;

-- Dashboard subscriptions do not belong to one task, but still use the same
-- durable delivery and retry contract.
ALTER TABLE task_notification_delivery
    ALTER COLUMN task_id DROP NOT NULL,
    ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT NOW();
