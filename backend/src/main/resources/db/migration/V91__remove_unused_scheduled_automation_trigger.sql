-- Task plans own time-based generation. No runtime publishes a standalone
-- automation schedule event, so reject that dead configuration surface.

UPDATE task_automation_rule
SET status = 'archived',
    is_deleted = TRUE,
    deleted_at = NOW(),
    updated_at = NOW()
WHERE trigger_type = 'schedule'
  AND is_deleted = FALSE;

ALTER TABLE task_automation_rule
    DROP CONSTRAINT ck_task_automation_rule_trigger;

ALTER TABLE task_automation_rule
    ADD CONSTRAINT ck_task_automation_rule_trigger
    CHECK (trigger_type IN ('submission_approved','metric_threshold','task_completed'));
