-- Widget creation is already captured by the task_analytics audit event. The
-- row-level creation timestamp is neither returned nor queried by a terminal
-- API/UI/job, while updated_at is the live widget revision indicator.
ALTER TABLE task_analytics_widget DROP COLUMN created_at;
