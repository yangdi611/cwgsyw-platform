-- V87: hard-cut the new metrics/automation objects to their final contract.
-- V81 created these tables as placeholders and no released runtime consumed
-- them, so duplicate compatibility columns are deliberately not retained.

ALTER TABLE task_metric_definition RENAME COLUMN metric_type TO value_type;
ALTER TABLE task_metric_definition
    ADD COLUMN scale INT NOT NULL DEFAULT 4,
    ADD COLUMN formula_config JSONB,
    ADD COLUMN authority_policy JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE task_metric_definition
SET authority_policy = jsonb_strip_nulls(jsonb_build_object(
    'templateVersionId', authoritative_template_version_id,
    'fieldKey', authoritative_field_key,
    'sourceRole', 'fact'
));

ALTER TABLE task_metric_definition
    DROP COLUMN authoritative_template_version_id,
    DROP COLUMN authoritative_field_key;

ALTER TABLE task_metric_binding
    ADD COLUMN field_id BIGINT REFERENCES task_template_field(id),
    ADD COLUMN source_role VARCHAR(32) NOT NULL DEFAULT 'fact',
    ADD COLUMN unit_conversion JSONB,
    ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE task_metric_binding binding
SET field_id = field.id,
    source_role = CASE WHEN binding.is_authoritative THEN 'fact' ELSE 'system_rollup' END,
    unit_conversion = jsonb_build_object('factor', binding.conversion_factor)
FROM task_template_field field
WHERE field.template_version_id = binding.template_version_id
  AND field.field_key = binding.field_key
  AND field.tenant_id = binding.tenant_id;

ALTER TABLE task_metric_binding
    ALTER COLUMN field_id SET NOT NULL,
    DROP COLUMN conversion_factor,
    DROP COLUMN is_authoritative;

DROP INDEX uq_task_metric_binding;
CREATE UNIQUE INDEX uq_task_metric_binding
  ON task_metric_binding(metric_id, template_version_id, field_id);
CREATE INDEX idx_task_metric_binding_field
  ON task_metric_binding(tenant_id, template_version_id, field_id, enabled);

ALTER TABLE task_metric_fact RENAME COLUMN dimension_snapshot TO dimensions;
ALTER TABLE task_metric_fact RENAME COLUMN is_active TO effective;
ALTER TABLE task_metric_fact RENAME COLUMN activated_at TO created_at;
ALTER TABLE task_metric_fact RENAME COLUMN deactivated_at TO invalidated_at;
ALTER TABLE task_metric_fact
    ALTER COLUMN value TYPE NUMERIC(30,10),
    ADD COLUMN binding_id BIGINT REFERENCES task_metric_binding(id),
    ADD COLUMN numerator NUMERIC(30,10),
    ADD COLUMN denominator NUMERIC(30,10),
    ADD COLUMN business_date DATE,
    ADD COLUMN owner_user_id BIGINT,
    ADD COLUMN owner_user_name VARCHAR(255),
    ADD COLUMN owner_group_id BIGINT,
    ADD COLUMN owner_group_name VARCHAR(255),
    ADD COLUMN source_type VARCHAR(32) NOT NULL DEFAULT 'fact';

UPDATE task_metric_fact fact
SET business_date = task.business_date,
    owner_user_id = task.assignee_id,
    owner_user_name = COALESCE(task.organization_snapshot ->> 'realName', task.organization_snapshot ->> 'username'),
    owner_group_id = task.group_id,
    owner_group_name = task.organization_snapshot ->> 'groupName'
FROM task_instance task
WHERE task.id = fact.task_id AND task.tenant_id = fact.tenant_id;

CREATE INDEX idx_task_metric_fact_period
  ON task_metric_fact(tenant_id, metric_id, business_date, owner_group_id)
  WHERE effective;
CREATE UNIQUE INDEX uq_task_metric_fact_lineage
  ON task_metric_fact(metric_id, field_fact_id, source_type)
  WHERE field_fact_id IS NOT NULL;

ALTER TABLE task_metric_goal
    ADD COLUMN scope_type VARCHAR(32),
    ADD COLUMN scope_key VARCHAR(255),
    ADD COLUMN period_config JSONB,
    ADD COLUMN comparison VARCHAR(16),
    ADD COLUMN effective_from DATE,
    ADD COLUMN effective_to DATE;

UPDATE task_metric_goal
SET scope_type = target_type,
    scope_key = target_group_id::text,
    effective_from = period_start,
    effective_to = period_end,
    comparison = CASE WHEN threshold_direction = 'lower_better' THEN 'at_most' ELSE 'at_least' END;

ALTER TABLE task_metric_goal
    ALTER COLUMN scope_type SET NOT NULL,
    ALTER COLUMN comparison SET NOT NULL,
    ALTER COLUMN effective_from SET NOT NULL,
    ALTER COLUMN effective_to SET NOT NULL,
    DROP COLUMN target_type,
    DROP COLUMN target_group_id,
    DROP COLUMN period_start,
    DROP COLUMN period_end,
    DROP COLUMN threshold_direction;

ALTER TABLE task_metric_goal DROP CONSTRAINT task_metric_goal_period_type_check;
ALTER TABLE task_metric_goal
    ADD CONSTRAINT ck_task_metric_goal_scope CHECK (scope_type IN ('tenant','group')),
    ADD CONSTRAINT ck_task_metric_goal_period CHECK (period_type IN ('daily','weekly','monthly','quarterly','yearly','custom')),
    ADD CONSTRAINT ck_task_metric_goal_comparison CHECK (comparison IN ('at_least','at_most','exact'));

ALTER TABLE task_relation
    ADD COLUMN automation_execution_id BIGINT REFERENCES task_automation_execution(id);
UPDATE task_relation SET relation_type = CASE relation_type
    WHEN 'review' THEN 'recheck'
    WHEN 'follow_up' THEN 'derived'
    WHEN 'dependency' THEN 'blocks'
    ELSE relation_type END;
ALTER TABLE task_relation DROP CONSTRAINT task_relation_relation_type_check;
ALTER TABLE task_relation
    ADD CONSTRAINT ck_task_relation_type CHECK (relation_type IN ('remediation','recheck','derived','blocks','related')),
    ADD CONSTRAINT ck_task_relation_no_self_reference CHECK (source_task_id <> target_task_id);

ALTER TABLE task_automation_rule
    ADD COLUMN status VARCHAR(32),
    ADD COLUMN lock_version INT NOT NULL DEFAULT 0;
UPDATE task_automation_rule SET status = CASE WHEN enabled THEN 'active' ELSE 'paused' END;
ALTER TABLE task_automation_rule
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN status SET DEFAULT 'draft',
    DROP COLUMN enabled;
ALTER TABLE task_automation_rule DROP CONSTRAINT task_automation_rule_trigger_type_check;
ALTER TABLE task_automation_rule DROP CONSTRAINT task_automation_rule_action_type_check;
ALTER TABLE task_automation_rule
    ADD CONSTRAINT ck_task_automation_rule_trigger CHECK (trigger_type IN ('submission_approved','metric_threshold','task_completed','schedule')),
    ADD CONSTRAINT ck_task_automation_rule_action CHECK (action_type IN ('create_task','notify')),
    ADD CONSTRAINT ck_task_automation_rule_status CHECK (status IN ('draft','active','paused','archived'));

DROP INDEX uq_task_automation_execution_idempotency;
ALTER TABLE task_automation_execution RENAME COLUMN trigger_source_type TO source_type;
ALTER TABLE task_automation_execution RENAME COLUMN trigger_source_id TO source_id;
ALTER TABLE task_automation_execution RENAME COLUMN idempotency_key TO dedupe_key;
ALTER TABLE task_automation_execution RENAME COLUMN executed_at TO created_at;
ALTER TABLE task_automation_execution
    ADD COLUMN attempt_count INT NOT NULL DEFAULT 0,
    ADD COLUMN next_attempt_at TIMESTAMP,
    ADD COLUMN last_error TEXT,
    ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT NOW();
UPDATE task_automation_execution
SET last_error = CONCAT_WS(': ', error_code, error_message);
ALTER TABLE task_automation_execution
    DROP COLUMN error_code,
    DROP COLUMN error_message;
ALTER TABLE task_automation_execution DROP CONSTRAINT task_automation_execution_status_check;
ALTER TABLE task_automation_execution
    ADD CONSTRAINT ck_task_automation_execution_status CHECK (status IN ('pending','succeeded','failed','dead','skipped'));
CREATE UNIQUE INDEX uq_task_automation_execution_dedupe
  ON task_automation_execution(tenant_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
CREATE INDEX idx_task_automation_execution_retry
  ON task_automation_execution(tenant_id, status, next_attempt_at);

ALTER TABLE task_analytics_dashboard
    ADD COLUMN default_time_config JSONB;

ALTER TABLE task_analytics_subscription
    ADD COLUMN recipient_config JSONB,
    ADD COLUMN channel VARCHAR(32) NOT NULL DEFAULT 'notification',
    ADD COLUMN status VARCHAR(32),
    ADD COLUMN next_send_at TIMESTAMP;
UPDATE task_analytics_subscription
SET recipient_config = jsonb_build_object('ids', recipient_ids),
    status = CASE WHEN enabled THEN 'active' ELSE 'paused' END,
    schedule_config = schedule_config || jsonb_build_object('type', schedule_type);
ALTER TABLE task_analytics_subscription
    ALTER COLUMN recipient_config SET NOT NULL,
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN status SET DEFAULT 'active',
    DROP COLUMN recipient_ids,
    DROP COLUMN schedule_type,
    DROP COLUMN enabled;
ALTER TABLE task_analytics_subscription
    ADD CONSTRAINT ck_task_analytics_subscription_channel CHECK (channel IN ('notification','email')),
    ADD CONSTRAINT ck_task_analytics_subscription_status CHECK (status IN ('active','paused','archived'));
CREATE INDEX idx_task_analytics_subscription_due
  ON task_analytics_subscription(tenant_id, next_send_at)
  WHERE status = 'active' AND NOT is_deleted;
