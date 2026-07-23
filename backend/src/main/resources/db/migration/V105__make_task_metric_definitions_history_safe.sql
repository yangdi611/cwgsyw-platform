-- Metric facts preserve the interpretation of completed task submissions.
-- Definitions that were already soft-deleted must have no facts; remove their
-- dependent transient bindings/goals before converting to physical deletion.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM task_metric_definition definition
        JOIN task_metric_fact fact ON fact.metric_id = definition.id
        WHERE definition.is_deleted = TRUE
    ) THEN
        RAISE EXCEPTION 'Cannot remove a soft-deleted metric definition that still has metric facts';
    END IF;
END $$;

DELETE FROM task_metric_goal goal
USING task_metric_definition definition
WHERE definition.id = goal.metric_id
  AND definition.is_deleted = TRUE;

DELETE FROM task_metric_binding binding
USING task_metric_definition definition
WHERE definition.id = binding.metric_id
  AND definition.is_deleted = TRUE;

DELETE FROM task_metric_definition
WHERE is_deleted = TRUE;

DROP INDEX uq_task_metric_definition_code;

ALTER TABLE task_metric_definition
    DROP COLUMN created_by,
    DROP COLUMN updated_by,
    DROP COLUMN is_deleted,
    DROP COLUMN deleted_at,
    DROP COLUMN deleted_by;

CREATE UNIQUE INDEX uq_task_metric_definition_code
    ON task_metric_definition(tenant_id, code);
