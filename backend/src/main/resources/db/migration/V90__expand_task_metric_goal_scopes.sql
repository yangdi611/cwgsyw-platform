-- Task metric goals support all scopes defined by the unified-task data model.
-- Existing tenant/group rows remain valid; no data conversion is required.
ALTER TABLE task_metric_goal DROP CONSTRAINT ck_task_metric_goal_scope;
ALTER TABLE task_metric_goal
    ADD CONSTRAINT ck_task_metric_goal_scope
    CHECK (scope_type IN ('tenant', 'group', 'user', 'template'));
