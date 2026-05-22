-- V7: 通知中心 & 系统配置

-- ─────────────────────────────────────────────
-- sys_config
-- ─────────────────────────────────────────────
CREATE TABLE sys_config (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64)  NOT NULL DEFAULT 'default',
    config_key   VARCHAR(128) NOT NULL,
    config_value TEXT,
    description  VARCHAR(255),
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, config_key)
);

INSERT INTO sys_config (tenant_id, config_key, config_value, description) VALUES
('default', 'smtp.enabled',             'false',                                                         'SMTP 开关'),
('default', 'smtp.host',                '',                                                              'SMTP 服务器地址'),
('default', 'smtp.port',                '465',                                                           'SMTP 端口'),
('default', 'smtp.username',            '',                                                              'SMTP 用户名'),
('default', 'smtp.password',            '',                                                              'SMTP 密码'),
('default', 'smtp.from',                '',                                                              '发件人地址'),
('default', 'smtp.from_name',           'IT运维平台',                                                     '发件人名称'),
('default', 'smtp.ssl',                 'true',                                                          '启用 SSL'),
('default', 'notify.reminder.enabled',  'false',                                                         '日报提醒开关'),
('default', 'notify.reminder.cron',     '0 0 17 * * MON-FRI',                                           '日报提醒 Cron 表达式'),
('default', 'notify.reminder.template', '【IT运维平台】您今日尚未提交工作日报，请尽快填写。',             '日报提醒消息模板');

-- ─────────────────────────────────────────────
-- notification_message
-- ─────────────────────────────────────────────
CREATE TABLE notification_message (
    id         BIGSERIAL PRIMARY KEY,
    tenant_id  VARCHAR(64)  NOT NULL DEFAULT 'default',
    user_id    BIGINT       NOT NULL,
    title      VARCHAR(255) NOT NULL,
    content    TEXT         NOT NULL,
    type       VARCHAR(64)  NOT NULL DEFAULT 'system',
    ref_type   VARCHAR(64),
    ref_id     BIGINT,
    is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
    read_at    TIMESTAMP,
    is_deleted BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by BIGINT,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by BIGINT,
    updated_by BIGINT
);

CREATE INDEX idx_notification_user   ON notification_message(user_id, is_read)        WHERE NOT is_deleted;
CREATE INDEX idx_notification_tenant ON notification_message(tenant_id, created_at DESC) WHERE NOT is_deleted;

-- ─────────────────────────────────────────────
-- RBAC: notification resource
-- ─────────────────────────────────────────────
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
('notification', '通知中心', '["read","manage"]', 90);

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'notification';

-- All roles get notification:read
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE p.code = 'notification:read'
ON CONFLICT DO NOTHING;

-- Only super_admin and admin get notification:manage
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin') AND p.code = 'notification:manage'
ON CONFLICT DO NOTHING;
