-- V4: 日报表 + 新增资源权限

CREATE TABLE daily_report (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    group_id        BIGINT NOT NULL REFERENCES sys_group(id),
    reporter_id     BIGINT NOT NULL REFERENCES sys_user(id),
    report_date     DATE NOT NULL,
    completed_items TEXT NOT NULL,
    issues          TEXT,
    tomorrow_plan   TEXT NOT NULL,
    work_hours      NUMERIC(4,1),
    status          VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    process_inst_id VARCHAR(128),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    updated_by      BIGINT
);
CREATE INDEX idx_daily_report_reporter ON daily_report(reporter_id, report_date DESC);
CREATE INDEX idx_daily_report_group ON daily_report(group_id, report_date DESC);
CREATE INDEX idx_daily_report_status ON daily_report(status) WHERE NOT is_deleted;

CREATE TABLE daily_report_approval (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES daily_report(id),
    approver_id     BIGINT NOT NULL REFERENCES sys_user(id),
    action          VARCHAR(32) NOT NULL,
    comment         TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
('daily_report', '日报管理', '["create","read","update","submit","approve","export"]', 60),
('workflow',     '审批流',   '["read","configure"]', 70);

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code IN ('daily_report', 'workflow');

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin')
  AND p.code LIKE 'daily_report:%'
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin')
  AND p.code LIKE 'workflow:%'
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'group_leader'
  AND p.code IN ('daily_report:read', 'daily_report:approve');

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'member'
  AND p.code IN ('daily_report:create', 'daily_report:read', 'daily_report:update', 'daily_report:submit');
