-- V84: complete the unified task approval runtime contract.
-- The platform is not live and pre-WP05 approval rows have no complete Flowable lifecycle,
-- so those target-domain development rows are discarded instead of being guessed into the final model.

DELETE FROM approval_action;
DELETE FROM approval_round;

ALTER TABLE approval_round
    ADD COLUMN scheme_version_id BIGINT REFERENCES approval_scheme_version(id),
    ADD COLUMN process_definition_id VARCHAR(255),
    ADD COLUMN started_by BIGINT REFERENCES sys_user(id),
    ADD COLUMN result VARCHAR(32),
    ADD COLUMN ended_at TIMESTAMP;

ALTER TABLE approval_round
    ALTER COLUMN scheme_version_id SET NOT NULL,
    ALTER COLUMN process_definition_id SET NOT NULL,
    ALTER COLUMN started_by SET NOT NULL,
    DROP COLUMN completed_at;

ALTER TABLE approval_round DROP CONSTRAINT IF EXISTS approval_round_status_check;
ALTER TABLE approval_round
    ADD CONSTRAINT approval_round_status_check
    CHECK (status IN ('pending','in_review','approved','changes_requested','terminated','failed'));

ALTER TABLE approval_round
    ADD CONSTRAINT approval_round_result_check
    CHECK (result IS NULL OR result IN ('approved','changes_requested','terminated','failed'));

DROP INDEX IF EXISTS uq_approval_round;
CREATE UNIQUE INDEX uq_approval_round
    ON approval_round(tenant_id, task_id, round_number);

DROP INDEX IF EXISTS idx_approval_round_process;
CREATE UNIQUE INDEX uq_approval_round_process
    ON approval_round(tenant_id, process_instance_id)
    WHERE process_instance_id IS NOT NULL;

ALTER TABLE task_instance
    ADD COLUMN current_approval_round_id BIGINT REFERENCES approval_round(id);

CREATE INDEX idx_task_instance_current_approval_round
    ON task_instance(current_approval_round_id)
    WHERE current_approval_round_id IS NOT NULL;

ALTER TABLE task_instance DROP CONSTRAINT IF EXISTS task_instance_approval_status_check;
UPDATE task_instance
SET approval_status = CASE
    WHEN approval_scheme_version_id IS NULL THEN 'not_required'
    ELSE 'not_started'
END;
ALTER TABLE task_instance
    ADD CONSTRAINT task_instance_approval_status_check
    CHECK (approval_status IN
        ('not_required','not_started','in_review','approved','changes_requested','terminated','failed'));

ALTER TABLE approval_action
    ADD COLUMN submission_id BIGINT REFERENCES task_submission(id),
    ADD COLUMN flowable_task_id VARCHAR(255),
    ADD COLUMN node_key VARCHAR(255),
    ADD COLUMN node_name VARCHAR(255),
    ADD COLUMN approver_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE approval_action
    ALTER COLUMN submission_id SET NOT NULL,
    DROP COLUMN task_key;

ALTER TABLE approval_action DROP CONSTRAINT IF EXISTS approval_action_action_check;
ALTER TABLE approval_action
    ADD CONSTRAINT approval_action_action_check
    CHECK (action IN ('approve','return_for_changes','return_previous_node','terminate'));

CREATE UNIQUE INDEX uq_approval_action_flowable_task
    ON approval_action(tenant_id, flowable_task_id)
    WHERE flowable_task_id IS NOT NULL;

CREATE INDEX idx_approval_action_submission
    ON approval_action(submission_id, created_at);
