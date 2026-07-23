-- V80: add the unified task core schema without replacing existing platform schema.
-- 包含：任务模板、计划、实例、草稿、提交、审批方案、参与人、事件

-- ============================================================
-- 1. 任务模板（模板身份与生命周期）
-- ============================================================
CREATE TABLE task_template (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    code            VARCHAR(100) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    category        VARCHAR(100),
    description     TEXT,
    status          VARCHAR(32) NOT NULL DEFAULT 'draft',
    latest_version_id BIGINT,
    builtin         BOOLEAN NOT NULL DEFAULT FALSE,
    scope_type      VARCHAR(32) NOT NULL DEFAULT 'tenant',
    owner_group_id  BIGINT REFERENCES sys_group(id),
    created_by      BIGINT,
    updated_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    CHECK (status IN ('draft','published','deprecated','archived')),
    CHECK (scope_type IN ('tenant','group','private'))
);

CREATE UNIQUE INDEX uq_task_template_code
  ON task_template(tenant_id, code)
  WHERE NOT is_deleted;

CREATE INDEX idx_task_template_status
  ON task_template(tenant_id, status)
  WHERE NOT is_deleted;

-- ============================================================
-- 2. 任务模板版本（不可变快照）
-- ============================================================
CREATE TABLE task_template_version (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    template_id     BIGINT NOT NULL REFERENCES task_template(id),
    version         INT NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'draft',
    name_snapshot   VARCHAR(255) NOT NULL,
    description_snapshot TEXT,
    instructions    TEXT,
    layout_schema   JSONB,
    completion_policy JSONB,
    default_assignment JSONB,
    default_reminder JSONB,
    default_approval_scheme_version_id BIGINT,
    published_by    BIGINT,
    published_at    TIMESTAMP,
    created_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (status IN ('draft','published','deprecated'))
);

CREATE UNIQUE INDEX uq_task_template_version
  ON task_template_version(tenant_id, template_id, version);

CREATE INDEX idx_task_template_version_status
  ON task_template_version(template_id, status);

-- ============================================================
-- 3. 任务模板字段定义
-- ============================================================
CREATE TABLE task_template_field (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    template_version_id BIGINT NOT NULL REFERENCES task_template_version(id),
    parent_field_id BIGINT REFERENCES task_template_field(id),
    field_key       VARCHAR(100) NOT NULL,
    label           VARCHAR(255) NOT NULL,
    field_type      VARCHAR(50) NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    required        BOOLEAN NOT NULL DEFAULT FALSE,
    default_value   JSONB,
    validation_config JSONB,
    display_config  JSONB,
    visibility_config JSONB,
    condition_config JSONB,
    formula_config  JSONB,
    analytics_config JSONB,
    sensitive       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_task_template_field_key
  ON task_template_field(template_version_id, field_key);

CREATE INDEX idx_task_template_field_version
  ON task_template_field(template_version_id, sort_order);

-- ============================================================
-- 4. 审批方案
-- ============================================================
CREATE TABLE approval_scheme (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    code            VARCHAR(100) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(32) NOT NULL DEFAULT 'draft',
    latest_version_id BIGINT,
    scope_type      VARCHAR(32) NOT NULL DEFAULT 'tenant',
    owner_group_id  BIGINT REFERENCES sys_group(id),
    created_by      BIGINT,
    updated_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    CHECK (status IN ('draft','published','deprecated','archived')),
    CHECK (scope_type IN ('tenant','group','private'))
);

CREATE UNIQUE INDEX uq_approval_scheme_code
  ON approval_scheme(tenant_id, code)
  WHERE NOT is_deleted;

-- ============================================================
-- 5. 审批方案版本
-- ============================================================
CREATE TABLE approval_scheme_version (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    scheme_id       BIGINT NOT NULL REFERENCES approval_scheme(id),
    version         INT NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'draft',
    definition_config JSONB NOT NULL,
    process_definition_id VARCHAR(255),
    process_definition_key VARCHAR(255),
    process_definition_version INT,
    published_by    BIGINT,
    published_at    TIMESTAMP,
    created_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (status IN ('draft','published','deprecated'))
);

CREATE UNIQUE INDEX uq_approval_scheme_version
  ON approval_scheme_version(tenant_id, scheme_id, version);

-- ============================================================
-- 6. 任务计划（一次性与周期性统一）
-- ============================================================
CREATE TABLE task_plan (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    template_version_id BIGINT NOT NULL REFERENCES task_template_version(id),
    approval_scheme_version_id BIGINT REFERENCES approval_scheme_version(id),
    schedule_type   VARCHAR(32) NOT NULL,
    schedule_config JSONB NOT NULL,
    generation_mode VARCHAR(32) NOT NULL,
    assignment_rule JSONB NOT NULL,
    ci_scope_config JSONB,
    reminder_config JSONB,
    escalation_config JSONB,
    generate_ahead_days INT NOT NULL DEFAULT 7,
    start_date      DATE,
    end_date        DATE,
    status          VARCHAR(32) NOT NULL DEFAULT 'draft',
    next_generate_at TIMESTAMP,
    last_generated_at TIMESTAMP,
    lock_version    INT NOT NULL DEFAULT 0,
    created_by      BIGINT,
    updated_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    CHECK (schedule_type IN ('once','daily','weekly','monthly','quarterly','semiannual','yearly','cron','holiday_relative')),
    CHECK (generation_mode IN ('per_user','per_group','shared','single')),
    CHECK (status IN ('draft','active','paused','finished','archived'))
);

CREATE INDEX idx_task_plan_status
  ON task_plan(tenant_id, status)
  WHERE NOT is_deleted;

CREATE INDEX idx_task_plan_next_generate
  ON task_plan(next_generate_at)
  WHERE status = 'active' AND NOT is_deleted;

-- ============================================================
-- 7. 任务计划生成记录（幂等与重试）
-- ============================================================
CREATE TABLE task_plan_generation (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    plan_id         BIGINT NOT NULL REFERENCES task_plan(id),
    occurrence_key  VARCHAR(255) NOT NULL,
    occurrence_at   TIMESTAMP NOT NULL,
    subject_type    VARCHAR(32) NOT NULL,
    subject_id      BIGINT,
    status          VARCHAR(32) NOT NULL DEFAULT 'pending',
    task_id         BIGINT,
    error_code      VARCHAR(100),
    error_message   TEXT,
    attempt_count   INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (subject_type IN ('user','group','shared')),
    CHECK (status IN ('pending','succeeded','failed','skipped'))
);

CREATE UNIQUE INDEX uq_task_plan_generation_occurrence
  ON task_plan_generation(tenant_id, plan_id, occurrence_key);

CREATE INDEX idx_task_plan_generation_status
  ON task_plan_generation(plan_id, status);

-- ============================================================
-- 8. 任务实例
-- ============================================================
CREATE TABLE task_instance (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    plan_id         BIGINT REFERENCES task_plan(id),
    generation_id   BIGINT REFERENCES task_plan_generation(id),
    template_version_id BIGINT NOT NULL REFERENCES task_template_version(id),
    approval_scheme_version_id BIGINT REFERENCES approval_scheme_version(id),
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    business_date   DATE,
    planned_start_at TIMESTAMP,
    due_at          TIMESTAMP,
    priority        VARCHAR(32) NOT NULL DEFAULT 'normal',
    execution_status VARCHAR(32) NOT NULL DEFAULT 'not_started',
    approval_status VARCHAR(32),
    assignee_id     BIGINT REFERENCES sys_user(id),
    group_id        BIGINT REFERENCES sys_group(id),
    current_draft_revision INT,
    current_submission_id BIGINT,
    organization_snapshot JSONB,
    ci_scope_snapshot JSONB,
    overdue         BOOLEAN NOT NULL DEFAULT FALSE,
    started_at      TIMESTAMP,
    submitted_at    TIMESTAMP,
    completed_at    TIMESTAMP,
    cancelled_at    TIMESTAMP,
    cancel_reason   TEXT,
    lock_version    INT NOT NULL DEFAULT 0,
    created_by      BIGINT,
    updated_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    CHECK (priority IN ('low','normal','high','critical')),
    CHECK (execution_status IN ('not_started','in_progress','submitted','changes_requested','completed','cancelled','exception_closed')),
    CHECK (approval_status IS NULL OR approval_status IN ('pending','in_review','approved','rejected','terminated'))
);

CREATE INDEX idx_task_instance_assignee
  ON task_instance(tenant_id, assignee_id, execution_status)
  WHERE NOT is_deleted;

CREATE INDEX idx_task_instance_group
  ON task_instance(tenant_id, group_id, execution_status)
  WHERE NOT is_deleted;

CREATE INDEX idx_task_instance_calendar
  ON task_instance(tenant_id, business_date, planned_start_at, due_at)
  WHERE NOT is_deleted;

CREATE INDEX idx_task_instance_overdue
  ON task_instance(tenant_id, overdue, due_at)
  WHERE overdue AND NOT is_deleted;

-- ============================================================
-- 9. 任务参与人
-- ============================================================
CREATE TABLE task_participant (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id         BIGINT NOT NULL REFERENCES task_instance(id),
    user_id         BIGINT NOT NULL REFERENCES sys_user(id),
    role            VARCHAR(32) NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (role IN ('assignee','collaborator','copied','escalation'))
);

CREATE UNIQUE INDEX uq_task_participant
  ON task_participant(task_id, user_id, role);

CREATE INDEX idx_task_participant_user
  ON task_participant(tenant_id, user_id);

-- ============================================================
-- 10. 任务草稿（可修改）
-- ============================================================
CREATE TABLE task_draft (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id         BIGINT NOT NULL REFERENCES task_instance(id),
    revision        INT NOT NULL,
    form_data       JSONB NOT NULL,
    created_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_task_draft_revision
  ON task_draft(task_id, revision);

CREATE INDEX idx_task_draft_task
  ON task_draft(task_id, revision DESC);

CREATE TABLE task_draft_attachment (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id         BIGINT NOT NULL REFERENCES task_instance(id),
    draft_revision  INT NOT NULL,
    field_key       VARCHAR(100) NOT NULL,
    file_name       VARCHAR(500) NOT NULL,
    file_type       VARCHAR(100),
    size_bytes      BIGINT NOT NULL,
    object_key      VARCHAR(500) NOT NULL,
    checksum        VARCHAR(128),
    uploaded_by     BIGINT NOT NULL,
    uploaded_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, object_key)
);

CREATE INDEX idx_task_draft_attachment_task
  ON task_draft_attachment(task_id, draft_revision);

-- ============================================================
-- 11. 任务提交版本（不可变）
-- ============================================================
CREATE TABLE task_submission (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id         BIGINT NOT NULL REFERENCES task_instance(id),
    template_version_id BIGINT NOT NULL REFERENCES task_template_version(id),
    version         INT NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    form_data       JSONB NOT NULL,
    computed_values JSONB,
    template_version_snapshot JSONB NOT NULL,
    organization_snapshot JSONB,
    ci_references_snapshot JSONB,
    status          VARCHAR(32) NOT NULL DEFAULT 'current',
    effective       BOOLEAN NOT NULL DEFAULT FALSE,
    supersedes_submission_id BIGINT REFERENCES task_submission(id),
    content_hash    VARCHAR(64) NOT NULL,
    submitted_by    BIGINT NOT NULL,
    submitted_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (status IN ('current','pending_review','approved','changes_requested','superseded','terminated'))
);

CREATE UNIQUE INDEX uq_task_submission_version
  ON task_submission(task_id, version);

CREATE UNIQUE INDEX uq_task_submission_idempotency
  ON task_submission(tenant_id, task_id, idempotency_key);

CREATE INDEX idx_task_submission_task
  ON task_submission(task_id, version DESC);

CREATE INDEX idx_task_submission_status
  ON task_submission(tenant_id, status, submitted_at DESC);

-- ============================================================
-- 12. 任务提交附件快照
-- ============================================================
CREATE TABLE task_submission_attachment (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    submission_id   BIGINT NOT NULL REFERENCES task_submission(id),
    field_key       VARCHAR(100) NOT NULL,
    file_name       VARCHAR(500) NOT NULL,
    file_type       VARCHAR(100),
    size_bytes      BIGINT NOT NULL,
    object_key      VARCHAR(500) NOT NULL,
    checksum        VARCHAR(128),
    sensitive       BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_by     BIGINT,
    uploaded_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_submission_attachment
  ON task_submission_attachment(submission_id);

-- ============================================================
-- 13. 任务提交关联对象快照
-- ============================================================
CREATE TABLE task_submission_reference (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    submission_id   BIGINT NOT NULL REFERENCES task_submission(id),
    task_id         BIGINT NOT NULL REFERENCES task_instance(id),
    field_key       VARCHAR(100) NOT NULL,
    ref_type        VARCHAR(50) NOT NULL,
    ref_key         VARCHAR(255) NOT NULL,
    source_level    VARCHAR(32),
    ref_snapshot    JSONB NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_submission_reference
  ON task_submission_reference(submission_id);

CREATE INDEX idx_task_submission_reference_target
  ON task_submission_reference(tenant_id, ref_type, ref_key);

-- ============================================================
-- 14. 审批轮次
-- ============================================================
CREATE TABLE approval_round (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id         BIGINT NOT NULL REFERENCES task_instance(id),
    submission_id   BIGINT NOT NULL REFERENCES task_submission(id),
    round_number    INT NOT NULL,
    process_instance_id VARCHAR(128),
    status          VARCHAR(32) NOT NULL DEFAULT 'pending',
    started_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMP,
    CHECK (status IN ('pending','in_review','approved','rejected','terminated'))
);

CREATE UNIQUE INDEX uq_approval_round
  ON approval_round(task_id, round_number);

CREATE INDEX idx_approval_round_task
  ON approval_round(task_id, round_number DESC);

CREATE INDEX idx_approval_round_process
  ON approval_round(process_instance_id)
  WHERE process_instance_id IS NOT NULL;

-- ============================================================
-- 15. 审批动作
-- ============================================================
CREATE TABLE approval_action (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    round_id        BIGINT NOT NULL REFERENCES approval_round(id),
    task_key        VARCHAR(128),
    action          VARCHAR(32) NOT NULL,
    approver_id     BIGINT NOT NULL REFERENCES sys_user(id),
    comment         TEXT,
    field_comments  JSONB,
    attachment_comments JSONB,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (action IN ('approve','reject','terminate'))
);

CREATE INDEX idx_approval_action_round
  ON approval_action(round_id, created_at);

CREATE INDEX idx_approval_action_approver
  ON approval_action(tenant_id, approver_id, created_at DESC);

-- ============================================================
-- 16. 任务事件（时间线）
-- ============================================================
CREATE TABLE task_event (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id         BIGINT NOT NULL REFERENCES task_instance(id),
    event_type      VARCHAR(50) NOT NULL,
    operator_id     BIGINT,
    event_data      JSONB,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_event_task
  ON task_event(task_id, created_at DESC);

CREATE INDEX idx_task_event_type
  ON task_event(tenant_id, event_type, created_at DESC);

-- ============================================================
-- 17. 任务通知投递箱（幂等与重试）
-- ============================================================
CREATE TABLE task_notification_delivery (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id         BIGINT NOT NULL REFERENCES task_instance(id),
    submission_id   BIGINT REFERENCES task_submission(id),
    approval_round_id BIGINT REFERENCES approval_round(id),
    event_type      VARCHAR(64) NOT NULL,
    recipient_id    BIGINT NOT NULL REFERENCES sys_user(id),
    channel         VARCHAR(32) NOT NULL DEFAULT 'notification',
    dedupe_key      VARCHAR(255) NOT NULL,
    payload         JSONB NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'pending',
    attempt_count   INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMP,
    last_error      TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (channel IN ('notification','email')),
    CHECK (status IN ('pending','sent','failed','dead'))
);

CREATE UNIQUE INDEX uq_task_notification_delivery_dedupe
  ON task_notification_delivery(tenant_id, dedupe_key);

CREATE INDEX idx_task_notification_delivery_pending
  ON task_notification_delivery(status, next_attempt_at)
  WHERE status IN ('pending','failed');
