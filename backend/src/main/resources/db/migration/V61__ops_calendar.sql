-- V61: 运维日历 / Ops Calendar
-- 周期规则、任务实例、参与人、检查项、日志、关联对象、通知幂等、模板、排班、节假日历 + RBAC

-- ============================================================
-- 1. ops_schedule_rule 周期规则
-- ============================================================
CREATE TABLE ops_schedule_rule (
    id                    BIGSERIAL PRIMARY KEY,
    tenant_id             VARCHAR(64) NOT NULL DEFAULT 'default',
    name                  VARCHAR(255) NOT NULL,
    description           TEXT,
    task_type             VARCHAR(32) NOT NULL,
    enabled               BOOLEAN NOT NULL DEFAULT TRUE,
    trigger_type          VARCHAR(32) NOT NULL,
    trigger_config        TEXT NOT NULL DEFAULT '{}',
    generate_days_ahead   INT NOT NULL DEFAULT 7,
    reminder_config       TEXT NOT NULL DEFAULT '{}',
    due_config            TEXT NOT NULL DEFAULT '{}',
    assignee_rule         TEXT NOT NULL DEFAULT '{}',
    recipient_rule        TEXT NOT NULL DEFAULT '{}',
    escalation_rule       TEXT NOT NULL DEFAULT '{}',
    template_id           BIGINT,
    checklist_template_id BIGINT,
    visibility            VARCHAR(32) NOT NULL DEFAULT 'private',
    public_summary        TEXT,
    sensitive             BOOLEAN NOT NULL DEFAULT FALSE,
    next_generate_at      TIMESTAMP,
    last_generated_at     TIMESTAMP,
    is_deleted            BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at            TIMESTAMP,
    deleted_by            BIGINT,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by            BIGINT,
    updated_by            BIGINT,
    CHECK (task_type IN ('inspection','roster','report','compliance','monitoring','daily_report','other')),
    CHECK (trigger_type IN ('once','daily','weekly','monthly','quarterly','semiannual','yearly','cron','holiday_relative')),
    CHECK (visibility IN ('private','group','public'))
);
CREATE INDEX idx_ops_rule_tenant_enabled ON ops_schedule_rule(tenant_id, enabled) WHERE NOT is_deleted;
CREATE INDEX idx_ops_rule_next_generate ON ops_schedule_rule(next_generate_at) WHERE enabled AND NOT is_deleted;

-- ============================================================
-- 2. ops_schedule_task 任务实例
-- ============================================================
CREATE TABLE ops_schedule_task (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           VARCHAR(64) NOT NULL DEFAULT 'default',
    rule_id             BIGINT REFERENCES ops_schedule_rule(id),
    occurrence_key      VARCHAR(128),
    title               VARCHAR(255) NOT NULL,
    task_type           VARCHAR(32) NOT NULL,
    source_type         VARCHAR(32) NOT NULL DEFAULT 'manual',
    status              VARCHAR(32) NOT NULL DEFAULT 'pending_confirm',
    planned_start_at    TIMESTAMP,
    due_at              TIMESTAMP,
    assignee_id         BIGINT REFERENCES sys_user(id),
    group_id            BIGINT REFERENCES sys_group(id),
    priority            VARCHAR(32) NOT NULL DEFAULT 'normal',
    content             TEXT,
    visibility          VARCHAR(32) NOT NULL DEFAULT 'private',
    public_summary      TEXT,
    sensitive           BOOLEAN NOT NULL DEFAULT FALSE,
    result_status       VARCHAR(32),
    result_summary      TEXT,
    risk_level          VARCHAR(32),
    confirmed_at        TIMESTAMP,
    confirmed_by        BIGINT REFERENCES sys_user(id),
    started_at          TIMESTAMP,
    completed_at        TIMESTAMP,
    completed_by        BIGINT REFERENCES sys_user(id),
    cancelled_at        TIMESTAMP,
    cancelled_by        BIGINT REFERENCES sys_user(id),
    close_reason        TEXT,
    is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMP,
    deleted_by          BIGINT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by          BIGINT,
    updated_by          BIGINT,
    CHECK (task_type IN ('inspection','roster','report','compliance','monitoring','daily_report','other')),
    CHECK (source_type IN ('manual','rule','holiday','roster','system')),
    CHECK (status IN ('pending_confirm','not_started','in_progress','completed','overdue','exception_closed','cancelled')),
    CHECK (priority IN ('low','normal','high','critical')),
    CHECK (risk_level IS NULL OR risk_level IN ('none','low','medium','high','critical')),
    CHECK (visibility IN ('private','group','public'))
);
CREATE UNIQUE INDEX uq_ops_task_occurrence
  ON ops_schedule_task(tenant_id, rule_id, occurrence_key)
  WHERE rule_id IS NOT NULL AND occurrence_key IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_ops_task_calendar ON ops_schedule_task(tenant_id, planned_start_at, due_at) WHERE NOT is_deleted;
CREATE INDEX idx_ops_task_assignee ON ops_schedule_task(tenant_id, assignee_id, status) WHERE NOT is_deleted;
CREATE INDEX idx_ops_task_group ON ops_schedule_task(tenant_id, group_id, status) WHERE NOT is_deleted;
CREATE INDEX idx_ops_task_status ON ops_schedule_task(tenant_id, status, due_at) WHERE NOT is_deleted;

-- ============================================================
-- 3. ops_schedule_task_participant 参与人
-- ============================================================
CREATE TABLE ops_schedule_task_participant (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id     BIGINT NOT NULL REFERENCES ops_schedule_task(id),
    user_id     BIGINT NOT NULL REFERENCES sys_user(id),
    role        VARCHAR(32) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (role IN ('assignee','collaborator','recipient','escalation'))
);
CREATE UNIQUE INDEX uq_ops_task_participant
  ON ops_schedule_task_participant(task_id, user_id, role);
CREATE INDEX idx_ops_participant_user
  ON ops_schedule_task_participant(tenant_id, user_id, role);

-- ============================================================
-- 4. ops_schedule_checklist_item 检查项
-- ============================================================
CREATE TABLE ops_schedule_checklist_item (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id     BIGINT NOT NULL REFERENCES ops_schedule_task(id),
    title       VARCHAR(255) NOT NULL,
    required    BOOLEAN NOT NULL DEFAULT FALSE,
    input_type  VARCHAR(32) NOT NULL DEFAULT 'checkbox',
    options     TEXT,
    value       TEXT,
    checked     BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (input_type IN ('checkbox','text','number','select','attachment'))
);
CREATE INDEX idx_ops_checklist_task ON ops_schedule_checklist_item(task_id, sort_order);

-- ============================================================
-- 5. ops_schedule_task_log 任务动态日志（领域时间线）
-- ============================================================
CREATE TABLE ops_schedule_task_log (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id     BIGINT NOT NULL REFERENCES ops_schedule_task(id),
    action      VARCHAR(64) NOT NULL,
    operator_id BIGINT,
    content     TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ops_task_log_task ON ops_schedule_task_log(task_id, created_at DESC);

-- ============================================================
-- 6. ops_schedule_task_link 任务关联对象
-- ============================================================
CREATE TABLE ops_schedule_task_link (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id     BIGINT NOT NULL REFERENCES ops_schedule_task(id),
    link_type   VARCHAR(32) NOT NULL,
    link_id     BIGINT,
    link_title  VARCHAR(255),
    link_url    VARCHAR(512),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by  BIGINT,
    CHECK (link_type IN ('daily_report','ci_instance','prometheus_alert','change_doc','file','external'))
);
CREATE INDEX idx_ops_task_link_task ON ops_schedule_task_link(task_id, link_type);
CREATE INDEX idx_ops_task_link_object ON ops_schedule_task_link(tenant_id, link_type, link_id)
  WHERE link_id IS NOT NULL;

-- ============================================================
-- 7. ops_schedule_notification_log 通知幂等
-- ============================================================
CREATE TABLE ops_schedule_notification_log (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id        BIGINT NOT NULL REFERENCES ops_schedule_task(id),
    stage          VARCHAR(64) NOT NULL,
    user_id        BIGINT NOT NULL REFERENCES sys_user(id),
    channel        VARCHAR(32) NOT NULL DEFAULT 'notification',
    success        BOOLEAN NOT NULL DEFAULT FALSE,
    error_message  TEXT,
    retry_count    INT NOT NULL DEFAULT 0,
    sent_at        TIMESTAMP,
    last_error_at  TIMESTAMP,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_ops_notification_once
  ON ops_schedule_notification_log(task_id, stage, user_id, channel);

-- ============================================================
-- 8. ops_schedule_template 模板
-- ============================================================
CREATE TABLE ops_schedule_template (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      VARCHAR(64) NOT NULL DEFAULT 'default',
    name           VARCHAR(255) NOT NULL,
    template_type  VARCHAR(32) NOT NULL,
    task_type      VARCHAR(32),
    title_template TEXT,
    body_template  TEXT,
    checklist_json TEXT,
    enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    is_builtin     BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted     BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at     TIMESTAMP,
    deleted_by     BIGINT,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by     BIGINT,
    updated_by     BIGINT,
    CHECK (template_type IN ('notification','checklist','mixed'))
);

-- ============================================================
-- 9. ops_duty_roster 排班
-- ============================================================
CREATE TABLE ops_duty_roster (
    id                 BIGSERIAL PRIMARY KEY,
    tenant_id          VARCHAR(64) NOT NULL DEFAULT 'default',
    duty_date          DATE NOT NULL,
    start_at           TIMESTAMP,
    end_at             TIMESTAMP,
    shift_name         VARCHAR(128) NOT NULL DEFAULT '全天',
    assignee_id        BIGINT NOT NULL REFERENCES sys_user(id),
    backup_assignee_id BIGINT REFERENCES sys_user(id),
    phone_override     VARCHAR(64),
    group_id           BIGINT REFERENCES sys_group(id),
    remark             TEXT,
    is_deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at         TIMESTAMP,
    deleted_by         BIGINT,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by         BIGINT,
    updated_by         BIGINT
);
CREATE INDEX idx_ops_roster_date ON ops_duty_roster(tenant_id, duty_date) WHERE NOT is_deleted;
CREATE INDEX idx_ops_roster_assignee ON ops_duty_roster(tenant_id, assignee_id, duty_date) WHERE NOT is_deleted;

-- ============================================================
-- 10. ops_holiday_calendar 节假日历
-- ============================================================
CREATE TABLE ops_holiday_calendar (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL DEFAULT 'default',
    name              VARCHAR(255) NOT NULL,
    start_date        DATE NOT NULL,
    end_date          DATE NOT NULL,
    holiday_type      VARCHAR(32) NOT NULL DEFAULT 'legal',
    workday_overrides TEXT NOT NULL DEFAULT '[]',
    enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    remark            TEXT,
    is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMP,
    deleted_by        BIGINT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by        BIGINT,
    updated_by        BIGINT,
    CHECK (holiday_type IN ('legal','company','campaign'))
);
CREATE INDEX idx_ops_holiday_range ON ops_holiday_calendar(tenant_id, start_date, end_date)
  WHERE enabled AND NOT is_deleted;

-- ============================================================
-- 11. RBAC: 资源 + 权限 + 角色分配
-- ============================================================
INSERT INTO sys_resource (code, name, actions, sort_order)
VALUES ('ops_calendar', '运维日历', '["read","read_group","read_all","create","update","complete","manage","export"]'::jsonb, 65)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    actions = EXCLUDED.actions,
    sort_order = EXCLUDED.sort_order;

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'ops_calendar'
ON CONFLICT (code) DO NOTHING;

-- super_admin / admin: 全部权限
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin') AND p.code LIKE 'ops_calendar:%'
ON CONFLICT DO NOTHING;

-- group_leader: read, read_group, create, update, complete, export
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'group_leader'
  AND p.code IN ('ops_calendar:read','ops_calendar:read_group','ops_calendar:create',
                 'ops_calendar:update','ops_calendar:complete','ops_calendar:export')
ON CONFLICT DO NOTHING;

-- member: read, create, complete
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'member'
  AND p.code IN ('ops_calendar:read','ops_calendar:create','ops_calendar:complete')
ON CONFLICT DO NOTHING;

-- viewer: read
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'viewer' AND p.code = 'ops_calendar:read'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 12. 内置规则 seed（仅「日报未提交提醒」默认启用，其余默认停用）
-- ============================================================
INSERT INTO ops_schedule_rule
  (tenant_id, name, description, task_type, enabled, trigger_type, trigger_config,
   generate_days_ahead, reminder_config, due_config, assignee_rule, recipient_rule,
   escalation_rule, visibility, sensitive, created_by, updated_by)
VALUES
  ('default', '日报未提交提醒', '每个工作日提醒未提交日报的用户', 'daily_report', TRUE, 'daily',
   '{"time":"17:00","weekdays":["MON","TUE","WED","THU","FRI"]}', 0,
   '{"stages":[{"stage":"created","offsetHours":0}]}', '{"offsetDays":0,"time":"23:59"}',
   '{"type":"unsubmitted_daily_report"}', '{"type":"unsubmitted_daily_report"}', '{}',
   'group', FALSE, 0, 0),
  ('default', '下周巡检负责人提醒', '每周五提醒下周巡检负责人', 'inspection', FALSE, 'weekly',
   '{"weekday":"FRI","time":"16:00","interval":1}', 7,
   '{"stages":[{"stage":"created","offsetHours":0}]}', '{"offsetDays":7,"time":"18:00"}',
   '{"type":"roster_next_week"}', '{"type":"assignee"}', '{}',
   'group', FALSE, 0, 0),
  ('default', '季报提醒', '每季度最后 5 天提醒组长准备季报', 'report', FALSE, 'quarterly',
   '{"quarterPosition":"last_day","offsetDays":-5,"time":"09:00"}', 7,
   '{"stages":[{"stage":"created","offsetHours":0},{"stage":"remind_1d","offsetHoursBeforeDue":24}]}',
   '{"offsetDays":5,"time":"18:00"}', '{"type":"group_leader"}', '{"type":"assignee"}',
   '{"overdueHours":24}', 'group', FALSE, 0, 0),
  ('default', '季度用户核查', '每季度第 1 天提醒用户核查与密码更新', 'compliance', FALSE, 'quarterly',
   '{"quarterPosition":"first_day","offsetDays":0,"time":"09:00"}', 3,
   '{"stages":[{"stage":"created","offsetHours":0}]}', '{"offsetDays":5,"time":"18:00"}',
   '{"type":"group_leader"}', '{"type":"assignee"}', '{}', 'group', FALSE, 0, 0),
  ('default', '季度密码更新', '每季度第 1 天提醒数据库/云资源密码更新', 'compliance', FALSE, 'quarterly',
   '{"quarterPosition":"first_day","offsetDays":0,"time":"09:00"}', 3,
   '{"stages":[{"stage":"created","offsetHours":0}]}', '{"offsetDays":5,"time":"18:00"}',
   '{"type":"group_leader"}', '{"type":"assignee"}', '{}', 'group', TRUE, 0, 0),
  ('default', '半年报归集', '每半年最后 10 天归集素材', 'report', FALSE, 'semiannual',
   '{"position":"last_day","offsetDays":-10,"time":"09:00"}', 14,
   '{"stages":[{"stage":"created","offsetHours":0}]}', '{"offsetDays":10,"time":"18:00"}',
   '{"type":"group_leader"}', '{"type":"assignee"}', '{}', 'group', FALSE, 0, 0);

