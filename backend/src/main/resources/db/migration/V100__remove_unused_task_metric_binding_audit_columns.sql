-- Binding provenance is represented by its metric facts and task timeline.
-- No API or UI reads the binding creation audit fields.
ALTER TABLE task_metric_binding
    DROP COLUMN created_by,
    DROP COLUMN created_at;
