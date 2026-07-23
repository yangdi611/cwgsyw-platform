-- V81: add unified task analytics and automation tables.
-- 包含：字段事实、指标定义、指标绑定、指标事实、看板、自动化规则、任务关联

-- ============================================================
-- 1. 字段事实（规范化字段值，用于统计）
-- ============================================================
CREATE TABLE task_field_fact (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    submission_id   BIGINT NOT NULL REFERENCES task_submission(id),
    task_id         BIGINT NOT NULL REFERENCES task_instance(id),
    template_version_id BIGINT NOT NULL REFERENCES task_template_version(id),
    field_key       VARCHAR(100) NOT NULL,
    field_type      VARCHAR(50) NOT NULL,
    value_text      TEXT,
    value_number    NUMERIC(20,4),
    value_boolean   BOOLEAN,
    value_date      DATE,
    value_json      JSONB,
    dimension_snapshot JSONB,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    activated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    deactivated_at  TIMESTAMP
);

CREATE INDEX idx_task_field_fact_submission
  ON task_field_fact(submission_id);

CREATE INDEX idx_task_field_fact_analytics
  ON task_field_fact(tenant_id, template_version_id, field_key, is_active);

CREATE INDEX idx_task_field_fact_number
  ON task_field_fact(tenant_id, field_key, value_number)
  WHERE value_number IS NOT NULL AND is_active;

CREATE INDEX idx_task_field_fact_date
  ON task_field_fact(tenant_id, field_key, value_date)
  WHERE value_date IS NOT NULL AND is_active;

-- ============================================================
-- 2. 跨模板指标定义
-- ============================================================
CREATE TABLE task_metric_definition (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    code            VARCHAR(100) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    metric_type     VARCHAR(32) NOT NULL,
    unit            VARCHAR(50),
    aggregation     VARCHAR(32) NOT NULL,
    additivity      VARCHAR(32) NOT NULL,
    authoritative_template_version_id BIGINT REFERENCES task_template_version(id),
    authoritative_field_key VARCHAR(100),
    created_by      BIGINT,
    updated_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    CHECK (metric_type IN ('number','ratio','percentage','duration','count')),
    CHECK (aggregation IN ('sum','avg','min','max','count','weighted_avg','ratio')),
    CHECK (additivity IN ('additive','non_additive','semi_additive'))
);

CREATE UNIQUE INDEX uq_task_metric_definition_code
  ON task_metric_definition(tenant_id, code)
  WHERE NOT is_deleted;

-- ============================================================
-- 3. 指标字段绑定（哪些模板字段映射到统一指标）
-- ============================================================
CREATE TABLE task_metric_binding (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    metric_id       BIGINT NOT NULL REFERENCES task_metric_definition(id),
    template_version_id BIGINT NOT NULL REFERENCES task_template_version(id),
    field_key       VARCHAR(100) NOT NULL,
    conversion_factor NUMERIC(20,4) DEFAULT 1.0,
    is_authoritative BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_task_metric_binding
  ON task_metric_binding(metric_id, template_version_id, field_key);

CREATE INDEX idx_task_metric_binding_template
  ON task_metric_binding(template_version_id);

-- ============================================================
-- 4. 指标事实（跨模板统一指标的汇总值）
-- ============================================================
CREATE TABLE task_metric_fact (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    metric_id       BIGINT NOT NULL REFERENCES task_metric_definition(id),
    submission_id   BIGINT NOT NULL REFERENCES task_submission(id),
    task_id         BIGINT NOT NULL REFERENCES task_instance(id),
    field_fact_id   BIGINT REFERENCES task_field_fact(id),
    value           NUMERIC(20,4) NOT NULL,
    dimension_snapshot JSONB,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    activated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    deactivated_at  TIMESTAMP
);

CREATE INDEX idx_task_metric_fact_metric
  ON task_metric_fact(tenant_id, metric_id, is_active);

CREATE INDEX idx_task_metric_fact_submission
  ON task_metric_fact(submission_id);

-- ============================================================
-- 5. 统计看板
-- ============================================================
CREATE TABLE task_analytics_dashboard (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    code            VARCHAR(100) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    scope_type      VARCHAR(32) NOT NULL DEFAULT 'private',
    owner_id        BIGINT REFERENCES sys_user(id),
    owner_group_id  BIGINT REFERENCES sys_group(id),
    layout_config   JSONB,
    created_by      BIGINT,
    updated_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    CHECK (scope_type IN ('private','group','tenant'))
);

CREATE UNIQUE INDEX uq_task_analytics_dashboard_code
  ON task_analytics_dashboard(tenant_id, code)
  WHERE NOT is_deleted;

CREATE INDEX idx_task_analytics_dashboard_owner
  ON task_analytics_dashboard(tenant_id, owner_id)
  WHERE NOT is_deleted;

-- ============================================================
-- 6. 看板组件
-- ============================================================
CREATE TABLE task_analytics_widget (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    dashboard_id    BIGINT NOT NULL REFERENCES task_analytics_dashboard(id),
    widget_type     VARCHAR(50) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    data_source_config JSONB NOT NULL,
    display_config  JSONB,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (widget_type IN ('kpi','line_chart','bar_chart','pie_chart','table','text_list','attachment_list','image_gallery'))
);

CREATE INDEX idx_task_analytics_widget_dashboard
  ON task_analytics_widget(dashboard_id, sort_order);

-- ============================================================
-- 7. 指标目标
-- ============================================================
CREATE TABLE task_metric_goal (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    metric_id       BIGINT NOT NULL REFERENCES task_metric_definition(id),
    target_type     VARCHAR(32) NOT NULL,
    target_group_id BIGINT REFERENCES sys_group(id),
    period_type     VARCHAR(32) NOT NULL,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    target_value    NUMERIC(20,4) NOT NULL,
    warning_threshold NUMERIC(20,4),
    critical_threshold NUMERIC(20,4),
    threshold_direction VARCHAR(32) NOT NULL,
    created_by      BIGINT,
    updated_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    CHECK (target_type IN ('group','tenant')),
    CHECK (period_type IN ('daily','weekly','monthly','quarterly','yearly')),
    CHECK (threshold_direction IN ('higher_better','lower_better'))
);

CREATE INDEX idx_task_metric_goal_metric
  ON task_metric_goal(tenant_id, metric_id, period_start, period_end)
  WHERE NOT is_deleted;

-- ============================================================
-- 8. 任务关联（整改-复查链路）
-- ============================================================
CREATE TABLE task_relation (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    source_task_id  BIGINT NOT NULL REFERENCES task_instance(id),
    target_task_id  BIGINT NOT NULL REFERENCES task_instance(id),
    relation_type   VARCHAR(32) NOT NULL,
    created_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (relation_type IN ('remediation','review','follow_up','dependency'))
);

CREATE UNIQUE INDEX uq_task_relation
  ON task_relation(source_task_id, target_task_id, relation_type);

CREATE INDEX idx_task_relation_source
  ON task_relation(source_task_id);

CREATE INDEX idx_task_relation_target
  ON task_relation(target_task_id);

-- ============================================================
-- 9. 自动化规则
-- ============================================================
CREATE TABLE task_automation_rule (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    trigger_type    VARCHAR(50) NOT NULL,
    trigger_config  JSONB NOT NULL,
    condition_config JSONB,
    action_type     VARCHAR(50) NOT NULL,
    action_config   JSONB NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      BIGINT,
    updated_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    CHECK (trigger_type IN ('submission_approved','metric_threshold','schedule')),
    CHECK (action_type IN ('create_task','send_notification','update_field'))
);

CREATE INDEX idx_task_automation_rule_enabled
  ON task_automation_rule(tenant_id, enabled)
  WHERE NOT is_deleted;

-- ============================================================
-- 10. 自动化执行记录
-- ============================================================
CREATE TABLE task_automation_execution (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    rule_id         BIGINT NOT NULL REFERENCES task_automation_rule(id),
    trigger_source_type VARCHAR(50),
    trigger_source_id BIGINT,
    idempotency_key VARCHAR(255),
    status          VARCHAR(32) NOT NULL DEFAULT 'pending',
    result_task_id  BIGINT REFERENCES task_instance(id),
    error_code      VARCHAR(100),
    error_message   TEXT,
    executed_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (status IN ('pending','succeeded','failed','skipped'))
);

CREATE UNIQUE INDEX uq_task_automation_execution_idempotency
  ON task_automation_execution(rule_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_task_automation_execution_rule
  ON task_automation_execution(rule_id, executed_at DESC);

CREATE INDEX idx_task_automation_execution_source
  ON task_automation_execution(trigger_source_type, trigger_source_id);

-- ============================================================
-- 11. 看板订阅（定时发送）
-- ============================================================
CREATE TABLE task_analytics_subscription (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    dashboard_id    BIGINT NOT NULL REFERENCES task_analytics_dashboard(id),
    name            VARCHAR(255) NOT NULL,
    recipient_type  VARCHAR(32) NOT NULL,
    recipient_ids   JSONB NOT NULL,
    schedule_type   VARCHAR(32) NOT NULL,
    schedule_config JSONB NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    last_sent_at    TIMESTAMP,
    created_by      BIGINT,
    updated_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    CHECK (recipient_type IN ('user','group','role')),
    CHECK (schedule_type IN ('daily','weekly','monthly'))
);

CREATE INDEX idx_task_analytics_subscription_dashboard
  ON task_analytics_subscription(dashboard_id)
  WHERE enabled AND NOT is_deleted;
